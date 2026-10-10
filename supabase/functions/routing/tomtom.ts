import { isCoordinates, MAX_DISTANCE_METERS, geographicDistanceMeters,
  type RouteRequest, type DrivingRoute, type RoutingProvider, type RoutingFailure } from '../../../packages/routing/index.ts';

export class RoutingError extends Error {
  constructor(public readonly failure: RoutingFailure, public readonly status: number) {
    super(failure.message);
  }
}
export const unavailable = () => new RoutingError({ code: 'ROUTING_UNAVAILABLE',
  message: 'Driving time unavailable', retryable: true }, 502);

/** Primary duration uses traffic=true/departAt=now; no free-flow substitution. */
export class TomTomRoutingProvider implements RoutingProvider {
  constructor(private readonly apiKey: string | undefined,
    private readonly http: typeof fetch = fetch, private readonly timeoutMs = 8000,
    private readonly now: () => number = Date.now) {}

  async calculate(request: RouteRequest): Promise<DrivingRoute> {
    const { origin, destination } = request;
    if (!isCoordinates(origin) || !isCoordinates(destination) ||
      geographicDistanceMeters(origin, destination) > MAX_DISTANCE_METERS) {
      throw new RoutingError({ code: 'INVALID_INPUT', message: 'Invalid or out-of-range coordinates', retryable: false }, 400);
    }
    if (!this.apiKey?.trim()) throw new RoutingError({ code: 'ROUTING_NOT_CONFIGURED',
      message: 'Driving time unavailable: routing is not configured', retryable: false }, 503);
    const url = new URL(`https://api.tomtom.com/routing/1/calculateRoute/${origin.lat},${origin.lng}:${destination.lat},${destination.lng}/json`);
    url.search = new URLSearchParams({ key: this.apiKey, travelMode: 'car', routeType: 'fastest',
      traffic: 'true', departAt: 'now', routeRepresentation: 'summaryOnly', computeTravelTimeFor: 'all', maxAlternatives: '0' }).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.http(url, { signal: controller.signal, redirect: 'error' });
      if (response.status === 429) throw new RoutingError({ code: 'EXTERNAL_RATE_LIMITED',
        message: 'Driving time unavailable: provider rate limit reached', retryable: true }, 429);
      if (!response.ok) throw unavailable();
      const data: unknown = await response.json();
      const routes = data && typeof data === 'object' ? (data as Record<string, unknown>).routes : null;
      const first: unknown = Array.isArray(routes) ? routes[0] : null;
      const summary = first && typeof first === 'object' ? (first as Record<string, unknown>).summary : null;
      if (!summary || typeof summary !== 'object') throw unavailable();
      const s = summary as Record<string, unknown>;
      for (const field of ['travelTimeInSeconds', 'lengthInMeters', 'liveTrafficIncidentsTravelTimeInSeconds']) {
        if (typeof s[field] !== 'number' || !Number.isFinite(s[field]) || (s[field] as number) < 0) throw unavailable();
      }
      return { origin, destination, drivingDurationSeconds: s.travelTimeInSeconds as number,
        roadDistanceMeters: s.lengthInMeters as number, trafficAware: true,
        provider: 'tomtom', calculatedAt: new Date(this.now()).toISOString() };
    } catch (error) {
      if (controller.signal.aborted) throw new RoutingError({ code: 'ROUTING_TIMEOUT',
        message: 'Driving time unavailable: provider timed out', retryable: true }, 504);
      if (error instanceof RoutingError) throw error;
      // Never expose provider bodies, request URLs (containing credentials), or raw exceptions.
      throw unavailable();
    } finally { clearTimeout(timer); }
  }
}
