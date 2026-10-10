import { isDrivingRoute, isRoutingBatchRequest, sameCoordinates, ROUTE_MAX_AGE_MS,
  type Coordinates, type RouteOutcome, type RoutingFailure, type RoutingBatchRequest } from '../../../../../packages/routing';
import type { Alternative } from './congestion';
import type { MapStation } from './types';
export { ROUTE_MAX_AGE_MS } from '../../../../../packages/routing';

/** Input comes exclusively from the compatibility/freshness/geographic shortlist. */
export function routingCandidates(station: MapStation, alternatives: Alternative[], userOrigin?: Coordinates): RoutingBatchRequest {
  return { origin: userOrigin === undefined ? { lat: station.latitude, lng: station.longitude } : userOrigin,
    destinations: alternatives.map((a) => ({ lat: a.evidence.station.latitude, lng: a.evidence.station.longitude })) };
}

export class RoutingClientError extends Error {
  constructor(public readonly failure: RoutingFailure, public readonly retryAfterSeconds?: number) { super(failure.message); }
}
// Session-local efficiency only; neither this nor Edge isolate budgets protect global quota.
const CACHE_MS = 30000;
const cache = new Map<string, { savedAt: number; results: RouteOutcome[] }>();
const pending = new Map<string, { controller: AbortController; promise: Promise<RouteOutcome[]>; users: number }>();
let limitedUntil = 0;
const limitFailure: RoutingFailure = { code: 'RATE_LIMITED', message: 'Driving time unavailable: routing is rate limited; try later', retryable: true };
const isLimited = (failure: RoutingFailure) => failure.code === 'RATE_LIMITED' || failure.code === 'EXTERNAL_RATE_LIMITED';
const codes = ['INVALID_INPUT', 'ROUTING_NOT_CONFIGURED', 'ROUTING_TIMEOUT', 'ROUTING_UNAVAILABLE',
  'EXTERNAL_RATE_LIMITED', 'RATE_LIMITED'];
function isFailure(value: unknown): value is RoutingFailure {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return typeof e.code === 'string' && codes.includes(e.code) && typeof e.message === 'string' &&
    e.message.length <= 200 && typeof e.retryable === 'boolean';
}

export async function fetchDrivingRoutes(request: RoutingBatchRequest, signal?: AbortSignal): Promise<RouteOutcome[]> {
  if (!isRoutingBatchRequest(request)) throw new RoutingClientError({ code: 'INVALID_INPUT', message: 'Invalid routing candidates', retryable: false });
  if (signal?.aborted) throw new Error('Routing request cancelled');
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const identity = JSON.stringify([url, request.origin.lat, request.origin.lng, request.destinations.map((d) => [d.lat, d.lng])]);
  const now = Date.now();
  for (const [id, value] of cache) {
    if (now < value.savedAt || now - value.savedAt >= CACHE_MS || value.results.some((r) => 'route' in r &&
      (now < Date.parse(r.route.calculatedAt) || now - Date.parse(r.route.calculatedAt) > ROUTE_MAX_AGE_MS))) cache.delete(id);
  }
  if (url && key && cache.has(identity)) return cache.get(identity)!.results;
  if (now < limitedUntil) throw new RoutingClientError(limitFailure, Math.ceil((limitedUntil - now) / 1000));
  let entry = pending.get(identity);
  if (!entry) {
    const controller = new AbortController();
    entry = { controller, users: 0, promise: requestDrivingRoutes(request, controller.signal).then((results) => {
      if (!controller.signal.aborted && results.some((r) => 'route' in r)) {
        if (cache.size >= 20) cache.delete(cache.keys().next().value!);
        cache.set(identity, { savedAt: Date.now(), results });
      }
      return results;
    }).finally(() => { if (pending.get(identity)?.controller === controller) pending.delete(identity); }) };
    pending.set(identity, entry);
  }
  const shared = entry;
  shared.users++;
  // A selection change cancels only its subscriber; abort HTTP when nobody needs it.
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (result?: RouteOutcome[], error?: unknown) => {
      if (done) return;
      done = true;
      signal?.removeEventListener('abort', abort);
      if (--shared.users === 0) {
        shared.controller.abort();
        if (pending.get(identity) === shared) pending.delete(identity);
      }
      if (error !== undefined) reject(error); else resolve(result!);
    };
    const abort = () => finish(undefined, new Error('Routing request cancelled'));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    shared.promise.then((result) => finish(result), (error: unknown) => finish(undefined, error));
  });
}

async function requestDrivingRoutes(request: RoutingBatchRequest, signal: AbortSignal): Promise<RouteOutcome[]> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new RoutingClientError({ code: 'ROUTING_NOT_CONFIGURED', message: 'Driving time unavailable', retryable: false });
  const response = await fetch(`${url}/functions/v1/routing`, { method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal });
  const retryAfter = Number(response.headers.get('Retry-After'));
  const cooldown = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.max(60, Math.min(3600, retryAfter)) : 60;
  if (response.status === 429) limitedUntil = Math.max(limitedUntil, Date.now() + cooldown * 1000);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Invalid routing response');
  const body = data as Record<string, unknown>;
  if (!response.ok) {
    if (isFailure(body.error)) throw new RoutingClientError(body.error, response.status === 429 ? cooldown : undefined);
    if (response.status === 429) throw new RoutingClientError(limitFailure, cooldown);
    throw new Error('Driving time unavailable');
  }
  if (!Array.isArray(body.results) || body.results.length !== request.destinations.length) throw new Error('Incomplete routing response');
  const results: RouteOutcome[] = body.results.map((value: unknown, index) => {
    if (!value || typeof value !== 'object') throw new Error('Invalid routing result');
    const result = value as Record<string, unknown>;
    if (isDrivingRoute(result.route) && sameCoordinates(result.route.origin, request.origin) &&
      sameCoordinates(result.route.destination, request.destinations[index])) {
      const age = Date.now() - Date.parse(result.route.calculatedAt);
      if (age < -5000 || age > ROUTE_MAX_AGE_MS) throw new Error('Invalid routing timestamp');
      return { route: result.route };
    }
    if (!('route' in result) && isFailure(result.error)) return { error: result.error };
    throw new Error('Invalid routing result');
  });
  if (results.some((r) => 'error' in r && isLimited(r.error))) limitedUntil = Math.max(limitedUntil, Date.now() + 60000);
  return results;
}
