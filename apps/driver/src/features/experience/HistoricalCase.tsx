import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../../components/CalmUI';
import { colors } from '../map/tokens';
import type { MapStation } from '../map/types';
import { ChargingRecommendationCard } from './ChargingRecommendationCard';
import captured from './recordedCase.json';
import type { DrivingRoute } from '../../../../../packages/routing';

/** A separate recorded case. Never enters live recommendations or the routing client. */
export function HistoricalCase({ onSelect }: { onSelect: (station: MapStation) => void }) {
  const [compare, setCompare] = useState(false);
  return <View style={styles.container}>
    <Text style={styles.label}>VILNIUS · RECORDED CASE STUDY</Text>
    <Text style={styles.title}>From occupied to an option.</Text>
    <Text style={styles.notice}>10 Oct 2026 · Historical evidence. Current availability and driving times are unverified.</Text>
    {captured.recommendations.slice(0, compare ? 3 : 1).map((item, index) => <ChargingRecommendationCard key={item.evidence.station.location_id}
      station={item.evidence.station} available={item.available} connector="CCS2" route={item.route as DrivingRoute} distanceKm={item.distanceKm}
      origin={captured.selected.station.name} observedAt={item.evidence.evses[0].observed_at} historical primary={index === 0}
      reason={index === 0 ? 'Norfa’s CCS2 chargers were occupied. Rimi had compatible spare capacity and the shortest estimated drive among the three compared options.' : 'Compatible spare capacity in the same recorded comparison. Availability may have changed since this snapshot.'}
      onSelect={() => onSelect(item.evidence.station)} />)}
    <ActionButton secondary label={compare ? 'Show best recorded option' : 'Compare recorded alternatives'} onPress={() => setCompare((value) => !value)} />
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: 16, padding: 20 },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  title: { color: colors.textPrimary, fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.5 },
  notice: { color: colors.warning, fontSize: 13, lineHeight: 20 },
});
