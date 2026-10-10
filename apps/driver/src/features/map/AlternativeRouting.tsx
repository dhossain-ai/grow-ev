import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Coordinates, RouteOutcome } from '../../../../../packages/routing';
import type { Alternative, ConnectorStandard, StationEvidence } from './congestion';
import { fetchDrivingRoutes, routingCandidates, RoutingClientError } from './routingApi';
import { recommendAlternatives } from './recommendations';
import { colors, radii, spacing } from './tokens';
import type { MapStation } from './types';

/** Explicit shortlist comparison: map pan/zoom and clock ticks never request routes. */
export function AlternativeRouting({ target, alternatives, standard, now, onSelect, userOrigin }: {
  target: StationEvidence; alternatives: Alternative[]; standard: ConnectorStandard; now: number;
  onSelect: (station: MapStation) => void; userOrigin?: Coordinates;
}) {
  const station = target.station;
  const { origin, destinations } = routingCandidates(station, alternatives, userOrigin);
  const key = JSON.stringify([station.location_id, standard, userOrigin === undefined ? 'selected-charger' : 'user-origin', origin, alternatives.map((a) => a.evidence.station.location_id), destinations]);
  const [state, setState] = useState<{ key: string; loading: boolean; receivedAt?: number; results?: RouteOutcome[]; failure?: string; retryAt?: number } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => { controllerRef.current?.abort(); controllerRef.current = null; }, [key]);
  const current = state?.key === key ? state : null;
  const evidenceNow = Math.max(now, current?.receivedAt ?? now);
  const outcomes = Object.fromEntries(alternatives.flatMap((a, index) => current?.results?.[index] ?
    [[a.evidence.station.location_id, current.results[index]]] : []));
  const recommendation = recommendAlternatives(target, alternatives.map((a) => a.evidence), standard, evidenceNow, outcomes, userOrigin);
  const fresh = current?.results && recommendation.recommendations.length === alternatives.length &&
    recommendation.recommendations.every((a) => a.route !== null);
  const coolingDown = (current?.retryAt ?? 0) > evidenceNow;
  const compare = async () => {
    if (controllerRef.current || coolingDown || fresh) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 12000);
    setState({ key, loading: true });
    try {
      const results = await fetchDrivingRoutes({ origin, destinations }, controller.signal);
      if (!controller.signal.aborted) setState({ key, loading: false, results, receivedAt: Date.now(),
        retryAt: results.some((r) => 'error' in r && ['RATE_LIMITED', 'EXTERNAL_RATE_LIMITED'].includes(r.error.code)) ? Date.now() + 60000 : undefined });
    } catch (error) {
      if (controllerRef.current === controller) setState({ key, loading: false,
        failure: error instanceof RoutingClientError ? error.failure.message : 'Driving time unavailable',
        retryAt: error instanceof RoutingClientError && error.retryAfterSeconds ? Date.now() + error.retryAfterSeconds * 1000 : undefined });
    } finally { clearTimeout(timer); if (controllerRef.current === controller) controllerRef.current = null; }
  };
  if (!recommendation.recommendations.length) return <Text style={styles.muted}>No nearby station has fresh, compatible available capacity.</Text>;
  return <View style={{ gap: spacing.sm }}>
    <Text style={styles.muted}>{recommendation.originKind === 'selected-charger' ?
      'Charger-to-charger travel · from the selected charger to alternatives' : 'Driving from your provided origin to alternatives'}</Text>
    <Text style={styles.muted}>{recommendation.rankingBasis === 'driving-time' ?
      'Shortest estimated drive first among these nearby options.' :
      'Nearest first by straight-line distance from the selected charger. Comparable driving times are incomplete.'}</Text>
    <Pressable accessibilityRole="button" disabled={Boolean(current?.loading || fresh || coolingDown)} onPress={compare} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text style={{ color: colors.accent }}>{current?.loading ? 'Checking driving times…' : fresh ? 'Driving comparison up to date' : coolingDown ? 'Routing rate limited · try later' : 'Compare driving times'}</Text>
    </Pressable>
    {current?.failure ? <Text accessibilityRole="alert" style={{ color: colors.warning }}>{current.failure}</Text> : null}
    {recommendation.recommendations.map((a, index) => <Pressable key={a.evidence.station.location_id}
      accessibilityRole="button" accessibilityLabel={`Select ${a.evidence.station.name ?? a.evidence.station.address ?? 'alternative station'}`}
      onPress={() => onSelect(a.evidence.station)} style={[styles.card, index === 0 && styles.primary]}>
      <Text style={[styles.label, index === 0 && { color: colors.accent }]}>{index === 0 ? 'Recommended' : `Alternative ${index}`}</Text>
      <Text style={styles.name}>{a.evidence.station.name ?? a.evidence.station.address ?? 'Charging station'}</Text>
      <Text style={styles.muted}>{a.evidence.station.operator_name ?? 'Operator not reported'}</Text>
      {a.reasons.map((reason) => <Text key={reason} style={styles.muted}>{reason}</Text>)}
      {a.route ? <Text style={styles.muted}>TomTom · {a.route.trafficAware ? 'traffic-aware estimate' : 'estimate without traffic'} · calculated {new Date(a.route.calculatedAt).toLocaleTimeString()}</Text> : null}
      <Text style={styles.muted}>Oldest available observation: {new Date(a.capacity.observedAt!).toLocaleString()}</Text>
      <Text style={styles.label}>Select station →</Text>
    </Pressable>)}
    <Text style={styles.muted}>Observed availability can change before arrival.</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.elevated, borderRadius: radii.md, padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.overlayBorder },
  primary: { borderColor: colors.accent },
  label: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  muted: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
});
