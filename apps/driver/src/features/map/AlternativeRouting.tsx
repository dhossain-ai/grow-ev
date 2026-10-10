import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { RouteOutcome } from '../../../../../packages/routing';
import type { Alternative } from './congestion';
import { fetchDrivingRoutes, routingCandidates, ROUTE_MAX_AGE_MS, RoutingClientError } from './routingApi';
import { colors, spacing } from './tokens';
import type { MapStation } from './types';

/** Explicit shortlist comparison: map pan/zoom and clock ticks never request routes. */
export function AlternativeRouting({ station, alternatives, now }: {
  station: MapStation; alternatives: Alternative[]; now: number;
}) {
  const { origin, destinations } = routingCandidates(station, alternatives);
  const key = JSON.stringify([station.location_id, origin, alternatives.map((a) => a.evidence.station.location_id), destinations]);
  const [state, setState] = useState<{ key: string; loading: boolean; results?: RouteOutcome[]; failure?: string } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), [key]);
  const current = state?.key === key ? state : null;
  const fresh = current?.results?.every((r) => 'route' in r && now - Date.parse(r.route.calculatedAt) <= ROUTE_MAX_AGE_MS);
  const compare = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 12000);
    setState({ key, loading: true });
    try {
      const results = await fetchDrivingRoutes({ origin, destinations }, controller.signal);
      if (!controller.signal.aborted) setState({ key, loading: false, results });
    } catch (error) {
      if (controllerRef.current === controller) setState({ key, loading: false,
        failure: error instanceof RoutingClientError ? error.failure.message : 'Driving time unavailable' });
    } finally { clearTimeout(timer); }
  };
  if (!alternatives.length) return null;
  return <View style={{ gap: spacing.sm }}>
    <Text style={{ color: colors.textSecondary }}>Charger-to-charger travel · from the selected charger to alternatives · geographic shortlist order retained</Text>
    <Pressable accessibilityRole="button" disabled={Boolean(current?.loading || fresh)} onPress={compare}>
      <Text style={{ color: colors.accent }}>{current?.loading ? 'Checking driving times…' : fresh ? 'Driving comparison up to date' : 'Compare driving times'}</Text>
    </Pressable>
    {current?.failure ? <Text accessibilityRole="alert" style={{ color: colors.warning }}>{current.failure}</Text> : null}
    {alternatives.map((a, index) => {
      const result = current?.results?.[index];
      const route = result && 'route' in result && now - Date.parse(result.route.calculatedAt) <= ROUTE_MAX_AGE_MS ? result.route : null;
      return <View key={a.evidence.station.location_id}>
        <Text style={{ color: colors.textPrimary }}>{a.evidence.station.name ?? a.evidence.station.address ?? 'Charging station'}</Text>
        <Text style={{ color: colors.textSecondary }}>{route ?
          `${(route.drivingDurationSeconds / 60).toFixed(1)} min estimated charger-to-charger drive · ${(route.roadDistanceMeters / 1000).toFixed(1)} km by road · ${route.trafficAware ? 'traffic-aware' : 'without traffic'}` : 'Driving time unavailable'}</Text>
        {route ? <Text style={{ color: colors.textSecondary }}>TomTom · calculated {new Date(route.calculatedAt).toLocaleTimeString()}</Text> : null}
        {result && 'error' in result ? <Text style={{ color: colors.warning }}>{result.error.message}</Text> : null}
      </View>;
    })}
  </View>;
}
