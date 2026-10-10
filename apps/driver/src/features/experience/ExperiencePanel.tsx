import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Coordinates } from '../../../../../packages/routing';
import { CardReveal } from '../../components/CalmUI';
import type { ConnectorStandard } from '../map/congestion';
import { StationDetail } from '../map/StationDetail';
import { colors, radii } from '../map/tokens';
import type { MapStation } from '../map/types';
import { DriverAssistant } from './DriverAssistant';
import { HistoricalCase } from './HistoricalCase';

export function ExperiencePanel({ selected, standard, onStandardChange, expanded, onToggle, onClose,
  onSelect, stations, loading, error, userOrigin, showCase, onCase, onCloseCase }: {
  selected: MapStation | null; standard: ConnectorStandard; onStandardChange: (value: ConnectorStandard) => void;
  expanded: boolean; onToggle: () => void; onClose: () => void; onSelect: (station: MapStation) => void;
  stations: MapStation[]; loading: boolean; error: string | null; userOrigin?: Coordinates;
  showCase: boolean; onCase: () => void; onCloseCase: () => void;
}) {
  return <CardReveal key={showCase ? 'case' : selected?.location_id ?? 'home'} style={styles.panel}>
    {showCase ? <>
      <View style={styles.caseHeader}><Text style={styles.caseLabel}>THE GROW EV DIFFERENCE</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close recorded case study" onPress={onCloseCase} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
      <ScrollView showsVerticalScrollIndicator={false}><HistoricalCase onSelect={onSelect} /></ScrollView>
    </> : selected ? <StationDetail station={selected} expanded={expanded} onToggleExpanded={onToggle}
      onClose={onClose} onSelect={onSelect} userOrigin={userOrigin} standard={standard}
      onStandardChange={onStandardChange} onCase={onCase} /> :
      <DriverAssistant standard={standard} onChange={onStandardChange} stations={stations} loading={loading}
        error={error} onSelect={onSelect} onCase={onCase} />}
  </CardReveal>;
}
const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1,
    borderColor: colors.overlayBorder, overflow: 'hidden', boxShadow: `0 8px 32px ${colors.shadow}` },
  caseHeader: { paddingLeft: 20, paddingRight: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: colors.overlayBorder },
  caseLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  close: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.textPrimary, fontSize: 24 },
});
