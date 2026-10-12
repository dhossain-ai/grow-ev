import type { Coordinates, DrivingRoute } from '../../../../../packages/routing';
import { PredictionOutlook } from '../predictions/PredictionOutlook';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../../components/CalmUI';
import { ChargingPin } from '../../components/DriverIcons';
import type { ConnectorStandard, StationEvidence } from '../map/congestion';
import type { Recommendation } from '../map/recommendations';
import { colors } from '../map/tokens';
import { formatAge } from '../map/types';
import { compatibleObservation, equipmentLabel, sameCoordinates, stationTitle } from './presentation';

export function PremiumStationCard({
  evidence,
  standard,
  now,
  recommendation,
  route,
  featured = false,
  onDetails,
  onDirections,
  originKind = 'selected-charger',
  originLabel,
  originStationId,
  displayOrigin,
  routing = false,
}: {
  evidence: StationEvidence;
  standard: ConnectorStandard;
  now: number;
  recommendation?: Recommendation;
  route?: DrivingRoute | null;
  featured?: boolean;
  onDetails: () => void;
  onDirections: () => void;
  originKind?: 'selected-charger' | 'user-origin';
  originLabel?: string;
  originStationId?: string;
  displayOrigin?: Coordinates | null;
  routing?: boolean;
}) {
  route = route ?? recommendation?.route;
  const observation = compatibleObservation(evidence, standard, now);
  const isStartingPoint = originKind !== 'user-origin' && (
    evidence.station.location_id === originStationId ||
    (Boolean(displayOrigin) && sameCoordinates({ lat: evidence.station.latitude, lng: evidence.station.longitude }, displayOrigin!))
  );

  return <View style={[styles.card, featured && styles.featured]}>
    <View style={styles.headerRow}>
      <ChargingPin small={!featured} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" numberOfLines={2} style={styles.name}>{stationTitle(evidence.station)}</Text>
          {featured && recommendation ? <Text style={styles.badge}>Top match</Text> : null}
        </View>
        <Text style={styles.operator}>Operated by {evidence.station.operator_name || 'an unreported operator'}</Text>
      </View>
    </View>
    <View style={styles.metaRow}>
      <View style={styles.connectorBadge}>
        <Text style={styles.connectorText}>{equipmentLabel(evidence.station, standard)}</Text>
      </View>
    </View>
    <View style={styles.etaContainer}>
      {isStartingPoint ? <>
        <Text style={styles.drive}>Starting point</Text>
        <Text style={styles.caption}>Driving estimates start from this charger</Text>
      </> : route ? <>
        <Text style={styles.drive}>{Math.ceil(route.drivingDurationSeconds / 60)} min drive</Text>
        <Text style={styles.caption}>TomTom road estimate · from {originLabel ?? (originKind === 'user-origin' ? 'your requested location' : 'selected charger')}</Text>
      </> : routing ? <Text style={styles.metric}>Checking driving time…</Text> : <Text style={styles.metric}>Driving time unavailable</Text>}
    </View>
    <View style={styles.availabilityRow}>
      <View style={[styles.statusDot, { backgroundColor: observation.stale ? colors.textMuted : colors.markerAvailable }]} />
      <Text style={[styles.availabilityText, { color: observation.stale ? colors.textMuted : colors.accentInk }]}>{observation.label}</Text>
      <Text style={styles.ageText}>· Observed {formatAge(observation.observedAt)}{observation.stale ? ' (Stale)' : ''}</Text>
    </View>
    {recommendation ? <Text style={styles.reason}>{route ? 'Estimated road travel with observed spare capacity' : 'Nearby with observed spare capacity'}</Text> : null}
    <PredictionOutlook evidence={evidence} standard={standard} now={now} />
    <View style={styles.actionRow}>
      {featured ? <View style={{ flex: 1 }}><ActionButton label="Get directions  →" onPress={onDirections} /></View> : null}
      <View style={{ flex: featured ? .6 : 1 }}><ActionButton secondary label={featured ? 'Details' : 'View station  ›'} onPress={onDetails} /></View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 14, gap: 9, borderWidth: 1, borderColor: colors.overlayBorder, borderRadius: 18, backgroundColor: colors.main },
  featured: { borderColor: '#A7D65E' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { color: colors.textPrimary, fontSize: 18, lineHeight: 23, fontWeight: '700', letterSpacing: -.4, flexShrink: 1 },
  badge: { color: colors.textPrimary, backgroundColor: colors.accentSoft, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, fontWeight: '600' },
  operator: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  connectorBadge: { backgroundColor: colors.elevated, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  connectorText: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  etaContainer: { gap: 2 },
  drive: { color: colors.accentInk, fontSize: 20, lineHeight: 25, fontWeight: '700' },
  caption: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  availabilityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  availabilityText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  ageText: { fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  metric: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  reason: { color: colors.accentInk, fontSize: 13, lineHeight: 18 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
