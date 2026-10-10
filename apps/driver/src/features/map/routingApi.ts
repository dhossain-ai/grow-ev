import { isDrivingRoute, isRoutingBatchRequest, sameCoordinates, ROUTE_MAX_AGE_MS,
  type RouteOutcome, type RoutingFailure, type RoutingBatchRequest } from '../../../../../packages/routing';
import type { Alternative } from './congestion';
import type { MapStation } from './types';
export { ROUTE_MAX_AGE_MS } from '../../../../../packages/routing';

/** Input comes exclusively from the compatibility/freshness/geographic shortlist. */
export function routingCandidates(station: MapStation, alternatives: Alternative[]): RoutingBatchRequest {
  return { origin: { lat: station.latitude, lng: station.longitude },
    destinations: alternatives.map((a) => ({ lat: a.evidence.station.latitude, lng: a.evidence.station.longitude })) };
}

export class RoutingClientError extends Error {
  constructor(public readonly failure: RoutingFailure) { super(failure.message); }
}
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
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new RoutingClientError({ code: 'ROUTING_NOT_CONFIGURED', message: 'Driving time unavailable', retryable: false });
  const response = await fetch(`${url}/functions/v1/routing`, { method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal });
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Invalid routing response');
  const body = data as Record<string, unknown>;
  if (!response.ok) {
    if (isFailure(body.error)) throw new RoutingClientError(body.error);
    throw new Error('Driving time unavailable');
  }
  if (!Array.isArray(body.results) || body.results.length !== request.destinations.length) throw new Error('Incomplete routing response');
  return body.results.map((value: unknown, index) => {
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
}
