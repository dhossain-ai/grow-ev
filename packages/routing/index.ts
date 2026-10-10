/** WGS84 coordinates; durations are estimates, never observed journey times. */
export interface Coordinates { lat: number; lng: number }
export interface RouteRequest { origin: Coordinates; destination: Coordinates }
export interface DrivingRoute extends RouteRequest {
  drivingDurationSeconds: number;
  roadDistanceMeters: number;
  trafficAware: boolean;
  provider: 'tomtom';
  calculatedAt: string;
}
export interface RoutingProvider { calculate(request: RouteRequest): Promise<DrivingRoute> }
export type RoutingErrorCode = 'INVALID_INPUT' | 'ROUTING_NOT_CONFIGURED' |
  'ROUTING_TIMEOUT' | 'ROUTING_UNAVAILABLE' | 'EXTERNAL_RATE_LIMITED' | 'RATE_LIMITED';
export interface RoutingFailure { code: RoutingErrorCode; message: string; retryable: boolean }
export type RouteOutcome = { route: DrivingRoute } | { error: RoutingFailure };
export interface RoutingBatchRequest { origin: Coordinates; destinations: Coordinates[] }
export interface RoutingBatchResponse { results: RouteOutcome[] }
export const MAX_DESTINATIONS = 3;
export const MAX_DISTANCE_METERS = 15000;
export const ROUTE_MAX_AGE_MS = 120000;

export function isCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return typeof c.lat === 'number' && Number.isFinite(c.lat) && Math.abs(c.lat) <= 90 &&
    typeof c.lng === 'number' && Number.isFinite(c.lng) && Math.abs(c.lng) <= 180;
}

export function geographicDistanceMeters(a: Coordinates, b: Coordinates): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) *
    Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function isRoutingBatchRequest(value: unknown): value is RoutingBatchRequest {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return isCoordinates(r.origin) && Array.isArray(r.destinations) &&
    r.destinations.length > 0 && r.destinations.length <= MAX_DESTINATIONS &&
    r.destinations.every((d) => isCoordinates(d) &&
      geographicDistanceMeters(r.origin as Coordinates, d) <= MAX_DISTANCE_METERS) &&
    new Set(r.destinations.map((d: Coordinates) => `${d.lat},${d.lng}`)).size === r.destinations.length;
}

export function isDrivingRoute(value: unknown): value is DrivingRoute {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return isCoordinates(r.origin) && isCoordinates(r.destination) &&
    typeof r.drivingDurationSeconds === 'number' && Number.isFinite(r.drivingDurationSeconds) && r.drivingDurationSeconds >= 0 &&
    typeof r.roadDistanceMeters === 'number' && Number.isFinite(r.roadDistanceMeters) && r.roadDistanceMeters >= 0 &&
    typeof r.trafficAware === 'boolean' && r.provider === 'tomtom' &&
    typeof r.calculatedAt === 'string' && /Z$/.test(r.calculatedAt) && Number.isFinite(Date.parse(r.calculatedAt));
}

export function sameCoordinates(a: Coordinates, b: Coordinates): boolean {
  return a.lat === b.lat && a.lng === b.lng;
}
