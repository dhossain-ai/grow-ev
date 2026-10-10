import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Coordinates, RouteOutcome } from '../../../../../packages/routing';
import type { Alternative, ConnectorStandard, StationEvidence } from './congestion';
import { fetchDrivingRoutes, routingCandidates, RoutingClientError } from './routingApi';
import { recommendAlternatives } from './recommendations';
import { ChargingRecommendationCard } from '../experience/ChargingRecommendationCard';
import { ActionButton } from '../../components/CalmUI';
import { CONNECTOR_OPTIONS } from './congestion';
import { colors, spacing } from './tokens';
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
  const [showAlternatives, setShowAlternatives] = useState(false);
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
    <ActionButton secondary label={current?.loading ? 'Checking driving times…' : fresh ? 'Driving comparison up to date' : coolingDown ? 'Routing rate limited · try later' : 'Compare driving times'} disabled={Boolean(current?.loading || fresh || coolingDown)} onPress={() => { void compare(); }} />
    {current?.failure ? <Text accessibilityRole="alert" style={{ color: colors.warning }}>{current.failure}</Text> : null}
    {recommendation.recommendations.slice(0, showAlternatives ? 3 : 1).map((a, index) => <ChargingRecommendationCard key={a.evidence.station.location_id}
      station={a.evidence.station} available={a.capacity.available}
      connector={CONNECTOR_OPTIONS.find((option) => option.value === standard)!.label}
      route={a.route} distanceKm={a.distanceKm} origin={userOrigin ? 'your foreground location' : station.name ?? station.address ?? 'the selected station'}
      observedAt={a.capacity.observedAt!} primary={index === 0}
      reason={a.reasons.slice(0, 2).join(' ') + (a.capacity.stale || a.capacity.unknown ? ' ' + a.reasons[4] : '')}
      onSelect={() => onSelect(a.evidence.station)} />)}
    {recommendation.recommendations.length > 1 ? <ActionButton secondary label={showAlternatives ? 'Show recommended option' : 'Compare alternatives'} onPress={() => setShowAlternatives((value) => !value)} /> : null}
    <Text style={styles.muted}>Observed availability can change before arrival.</Text>
  </View>;
}

const styles = StyleSheet.create({
  muted: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
});
