import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionButton, ConnectorSelector } from '../../components/CalmUI';
import type { ConnectorStandard } from '../map/congestion';
import { colors } from '../map/tokens';
import { isStale, type MapStation } from '../map/types';

export function DriverAssistant({ standard, onChange, stations, loading, error, onSelect, onCase, discovery = false }: {
  standard: ConnectorStandard; onChange: (standard: ConnectorStandard) => void;
  stations: MapStation[]; loading: boolean; error: string | null;
  onSelect: (station: MapStation) => void; onCase: () => void;
  discovery?: boolean;
}) {
  const [requested, setChoosing] = useState(false);
  const choosing = requested || discovery;
  const compatible = stations.filter((station) => station.connector_types?.includes(standard));
  const allStale = compatible.length > 0 && compatible.every((station) => isStale(station));
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={styles.label}>YOUR CHARGING ASSISTANT</Text>
    <Text accessibilityRole="header" style={styles.title}>{choosing ? 'Start with a station.' : 'Find your\nnext charge.'}</Text>
    <Text style={styles.body}>{choosing ? 'Choose where you plan to charge. If it’s occupied, we’ll compare compatible nearby alternatives.' : 'Choose your connector. We’ll help you compare suitable options across networks.'}</Text>
    <ConnectorSelector value={standard} onChange={onChange} />
    {!choosing ? <ActionButton label="Find charging options" onPress={() => setChoosing(true)} /> : <>
      <Text style={styles.label}>IN THIS MAP AREA · {compatible.length} LOCATIONS</Text>
      {loading ? <Text style={styles.body}>Loading charging options…</Text> : error ? <Text accessibilityRole="alert" style={styles.body}>Charging options could not be loaded. Use Retry above the map.</Text> : !compatible.length ? <Text style={styles.body}>No matching stations here. Move the map or choose another connector.</Text> :
        compatible.slice(0, 8).map((station) => <Pressable key={station.location_id} accessibilityRole="button"
          accessibilityLabel={`Choose ${station.address ?? station.name ?? 'charging station'}`} onPress={() => onSelect(station)}
          style={({ pressed }) => [styles.station, { opacity: pressed ? 0.7 : 1 }]}>
          <View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.stationName}>{station.address ?? station.name ?? 'Charging station'}</Text>
            <Text numberOfLines={1} style={styles.caption}>{station.operator_name ?? 'Operator not reported'} · {isStale(station) ? 'Availability unverified' : 'Observed status · select to check compatibility'}</Text></View>
          <Text style={styles.chevron}>→</Text>
        </Pressable>)}
      {compatible.length > 8 ? <Text style={styles.caption}>Showing 8 locations. Tap any charger on the map to explore more.</Text> : null}
    </>}
    <View style={styles.evidence}><Text style={styles.evidenceTitle}>{allStale ? 'Current availability isn’t verified.' : 'Better decisions start with evidence.'}</Text>
      <Pressable accessibilityRole="button" onPress={onCase} style={styles.caseButton}><Text style={styles.caseText}>Explore the recorded case study ↗</Text></Pressable>
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  content: { padding: 24, gap: 12 },
  label: { color: colors.textSecondary, fontSize: 11, letterSpacing: 1.2, fontWeight: '600', lineHeight: 16 },
  title: { color: colors.textPrimary, fontSize: 30, fontWeight: '600', lineHeight: 34, letterSpacing: -0.8 },
  body: { color: colors.textSecondary, fontSize: 15, lineHeight: 23 },
  evidence: { borderTopWidth: 1, borderTopColor: colors.overlayBorder, paddingTop: 16, gap: 8 },
  evidenceTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  caption: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  caseButton: { minHeight: 44, justifyContent: 'center' },
  caseText: { color: colors.accentInk, fontSize: 13, fontWeight: '600' },
  station: { minHeight: 64, flexDirection: 'row', gap: 8, alignItems: 'center', borderBottomWidth: 1, borderColor: colors.overlayBorder, paddingVertical: 12 },
  stationName: { color: colors.textPrimary, fontSize: 15, fontWeight: '500', marginBottom: 4 },
  chevron: { color: colors.textSecondary, fontSize: 20 },
});
