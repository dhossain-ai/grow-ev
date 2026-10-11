import type { DrivingRoute } from '../../../../../packages/routing';
import { PredictionOutlook } from '../predictions/PredictionOutlook';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../../components/CalmUI';
import { ChargingPin } from '../../components/DriverIcons';
import type { ConnectorStandard, StationEvidence } from '../map/congestion';
import type { Recommendation } from '../map/recommendations';
import { colors } from '../map/tokens';
import { formatAge } from '../map/types';
import { compatibleObservation, equipmentLabel, stationTitle } from './presentation';

export function PremiumStationCard({ evidence, standard, now, recommendation, route, featured = false, onDetails, onDirections, originKind = 'selected-charger', originLabel, routing = false }: {
  evidence: StationEvidence; standard: ConnectorStandard; now: number; recommendation?: Recommendation; route?: DrivingRoute | null;
  featured?: boolean; onDetails: () => void; onDirections: () => void;
  originKind?: 'selected-charger' | 'user-origin'; originLabel?: string; routing?: boolean;
}) {
  route = route ?? recommendation?.route;
  const observation = compatibleObservation(evidence, standard, now);
  return <View style={[styles.card, featured && styles.featured]}>
    <View style={styles.row}><ChargingPin small={!featured} /><View style={{ flex: 1, gap: 3 }}>
      <View style={styles.row}><Text accessibilityRole="header" style={styles.name}>{stationTitle(evidence.station)}</Text>{featured && recommendation ? <Text style={styles.badge}>Top match</Text> : null}</View>
      <Text style={styles.caption}>Operated by {evidence.station.operator_name || 'an unreported operator'}</Text>
    </View></View>
    <View style={styles.metrics}><Text style={styles.metric}>{equipmentLabel(evidence.station, standard)}</Text><Text style={[styles.metric, { color: observation.stale ? colors.textMuted : colors.accentInk }]}>{observation.label}</Text></View>
    <Text style={styles.caption}>Observed {formatAge(observation.observedAt)}{observation.stale ? ' · Stale' : ''}</Text>
    <Text style={route ? styles.drive : styles.metric}>{route ? `${Math.ceil(route.drivingDurationSeconds / 60)} min drive` : routing ? 'Checking driving time…' : 'Driving time unavailable'}</Text>
    {route ? <Text style={styles.caption}>TomTom road estimate · from {originLabel ?? (originKind === 'user-origin' ? 'your requested location' : 'selected charger')}</Text> : null}
    {recommendation ? <Text style={styles.reason}>{route ? 'Estimated road travel with observed spare capacity' : 'Nearby with observed spare capacity'}</Text> : null}
    <PredictionOutlook evidence={evidence} standard={standard} now={now} />
    <View style={styles.row}>{featured ? <View style={{ flex: 1 }}><ActionButton label="Get directions  →" onPress={onDirections} /></View> : null}<View style={{ flex: featured ? .6 : 1 }}><ActionButton secondary label={featured ? 'Details' : 'View station  ›'} onPress={onDetails} /></View></View>
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 14, gap: 8, borderWidth: 1, borderColor: colors.overlayBorder, borderRadius: 18, backgroundColor: colors.main },
  featured: { borderColor: '#A7D65E' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  name: { color: colors.textPrimary, fontSize: 18, lineHeight: 23, fontWeight: '700', letterSpacing: -.4, flexShrink: 1 },
  badge: { color: colors.textPrimary, backgroundColor: colors.accentSoft, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 },
  caption: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  drive: { color: colors.accentInk, fontSize: 20, lineHeight: 25, fontWeight: '700' },
  metric: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  reason: { color: colors.accentInk, fontSize: 13, lineHeight: 18 },
});
