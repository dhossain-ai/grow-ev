import { StyleSheet, Text, View } from 'react-native';
import type { DrivingRoute } from '../../../../../packages/routing';
import type { MapStation } from '../map/types';
import { colors, radii } from '../map/tokens';
import { ActionButton } from '../../components/CalmUI';

export function ChargingRecommendationCard({ station, available, connector, route, origin, observedAt, reason,
  distanceKm, historical = false, primary = true, onSelect }: {
  station: MapStation; available: number; connector: string; route: DrivingRoute | null;
  origin: string; observedAt: string; reason: string; distanceKm: number; historical?: boolean; primary?: boolean;
  onSelect: () => void;
}) {
  const seconds = route ? Math.round(route.drivingDurationSeconds) : null;
  return <View style={[styles.card, primary && styles.primary]}>
    <Text style={styles.eyebrow}>{historical ? 'RECORDED ALTERNATIVE · HISTORICAL' : primary ? 'RECOMMENDED ALTERNATIVE' : 'ANOTHER SUITABLE OPTION'}</Text>
    <Text accessibilityRole="header" style={styles.name}>{station.address && /^[A-Z0-9_-]{12,}$/.test(station.name ?? '') ? station.address : station.name ?? station.address ?? 'Charging station'}</Text>
    <Text style={styles.body}>{station.operator_name ?? 'Operator not reported'} · {connector}</Text>
    <View style={styles.metrics}>
      <View style={styles.metric}><Text style={styles.number}>{available}</Text><Text style={styles.body}>compatible EVSEs{historical ? '\nin the available snapshot' : '\nobserved available'}</Text></View>
      <View style={styles.metric}><Text style={[styles.number, !route && styles.unavailable]}>{seconds === null ? '—' : `${Math.floor(seconds / 60)}m ${seconds % 60}s`}</Text>
        <Text style={styles.body}>{route ? historical ? 'recorded drive estimate' : 'estimated drive' : 'Driving time unavailable'}</Text></View>
    </View>
    <Text style={styles.origin}>{route ? 'From' : 'Comparison starts at'} {origin}</Text>
    {!route ? <Text style={styles.caption}>{distanceKm.toFixed(2)} km straight-line from the selected station · road reachability unverified</Text> : null}
    <View style={styles.reason}><Text style={styles.reasonText}>{reason}</Text></View>
    <Text style={styles.caption}>{historical ? 'Snapshot' : 'Oldest available observation'} · {new Date(observedAt).toLocaleString('en-GB', { timeZone: 'Europe/Vilnius' })} Europe/Vilnius</Text>
    {route ? <Text style={styles.caption}>{(route.roadDistanceMeters / 1000).toFixed(2)} km by road · TomTom {route.trafficAware ? 'traffic-aware' : 'without traffic'} estimate · {new Date(route.calculatedAt).toLocaleTimeString('en-GB', { timeZone: 'Europe/Vilnius' })}</Text> : null}
    <ActionButton label={historical ? 'Explore this station' : 'Select this charger'} onPress={onSelect} secondary={!primary || historical} />
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.md, padding: 20, gap: 12, borderWidth: 1, borderColor: colors.overlayBorder },
  primary: { borderRadius: radii.lg, borderColor: colors.accentInk },
  eyebrow: { color: colors.accentInk, fontSize: 11, letterSpacing: 1.1, fontWeight: '700', lineHeight: 16 },
  name: { color: colors.textPrimary, fontSize: 24, lineHeight: 30, fontWeight: '600', letterSpacing: -0.6 },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  metrics: { flexDirection: 'row', gap: 16, paddingVertical: 8 },
  metric: { gap: 4, flex: 1, minWidth: 0 },
  number: { color: colors.textPrimary, fontSize: 26, lineHeight: 32, fontWeight: '600', letterSpacing: -0.6 },
  unavailable: { color: colors.textMuted },
  origin: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  reason: { backgroundColor: colors.accentSoft, borderRadius: radii.sm, padding: 16 },
  reasonText: { color: colors.accentInk, fontSize: 14, lineHeight: 21 },
  caption: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
});
