import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Coordinates } from '../../../../../packages/routing';
import { CardReveal } from '../../components/CalmUI';
import type { ConnectorStandard } from '../map/congestion';
import { StationDetail } from '../map/StationDetail';
import { colors, radii } from '../map/tokens';
import type { MapStation, StationFilters } from '../map/types';
import { VoiceControl } from '../voice/VoiceControl';
import { commandFilters, type VoiceCommand } from '../voice/commands';
import { fetchStationCapacity } from '../map/capacityApi';
import { recommendAlternatives } from '../map/recommendations';
import { DriverAssistant } from './DriverAssistant';
import { HistoricalCase } from './HistoricalCase';

export function ExperiencePanel({ selected, standard, onStandardChange, expanded, onToggle, onClose,
  onSelect, stations, loading, error, userOrigin, showCase, onCase, onCloseCase, filters, onFiltersChange, onLocate }: {
  selected: MapStation | null; standard: ConnectorStandard; onStandardChange: (value: ConnectorStandard) => void;
  expanded: boolean; onToggle: () => void; onClose: () => void; onSelect: (station: MapStation) => void;
  stations: MapStation[]; loading: boolean; error: string | null; userOrigin?: Coordinates;
  showCase: boolean; onCase: () => void; onCloseCase: () => void;
  filters: StationFilters; onFiltersChange: (filters: StationFilters) => void;
  onLocate: (signal: AbortSignal) => Promise<boolean>;
}) {
  const [discovery, setDiscovery] = useState(false);
  const onCommand = async (command: VoiceCommand, signal: AbortSignal): Promise<string> => {
    if (command.kind === 'alternative') {
      if (!selected || showCase) return 'Choose a real station first so we can check compatible alternatives.';
      const rows = await fetchStationCapacity(selected.location_id, signal);
      if (signal.aborted) return 'Command canceled.';
      const target = rows.find((row) => row.station.location_id === selected.location_id)!;
      const result = recommendAlternatives(target, rows, standard, Date.now(), {}, userOrigin);
      const primary = result.recommendations[0];
      if (!primary) return `No eligible alternative: selected compatible capacity is ${result.selectedCapacity.state}. Availability is based on fresh observations, never guaranteed.`;
      onSelect(primary.evidence.station);
      return `Selected the nearest eligible alternative with ${primary.capacity.available} compatible EVSEs observed available. Driving time unavailable; arrival availability is not guaranteed.`;
    }
    if (command.kind === 'nearby') {
      const located = await onLocate(signal);
      if (signal.aborted) return 'Command canceled.';
      if (!located) return 'Location unavailable. Enable location permission and retry using Locate me.';
      onCloseCase(); onClose(); setDiscovery(true);
      return 'Showing stations in the map area around your foreground location. Choose a station to check compatible capacity.';
    }
    onFiltersChange(commandFilters(command, filters, standard));
    if (command.kind === 'connector') onStandardChange(command.standard);
    onCloseCase(); onClose(); setDiscovery(true);
    return command.kind === 'fast' ? 'Applied the existing 50+ kW station filter with your selected connector. Site maximum power does not prove connector power or availability.' : 'Connector selected and map filtered. Choose a station to check real compatible capacity and alternatives.';
  };
  return <View style={styles.panel}>
    {!showCase ? <VoiceControl onCommand={onCommand} /> : null}
    <CardReveal key={showCase ? 'case' : selected?.location_id ?? 'home'} style={{ flex: 1 }}>
    {showCase ? <>
      <View style={styles.caseHeader}><Text style={styles.caseLabel}>THE GROW EV DIFFERENCE</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close recorded case study" onPress={onCloseCase} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
      <ScrollView showsVerticalScrollIndicator={false}><HistoricalCase onSelect={onSelect} /></ScrollView>
    </> : selected ? <StationDetail station={selected} expanded={expanded} onToggleExpanded={onToggle}
      onClose={onClose} onSelect={onSelect} userOrigin={userOrigin} standard={standard}
      onStandardChange={onStandardChange} onCase={onCase} /> :
      <DriverAssistant standard={standard} onChange={onStandardChange} stations={stations} loading={loading}
        error={error} onSelect={onSelect} onCase={onCase} discovery={discovery} />}
    </CardReveal>
  </View>;
}
const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1,
    borderColor: colors.overlayBorder, overflow: 'hidden', boxShadow: `0 8px 32px ${colors.shadow}` },
  caseHeader: { paddingLeft: 20, paddingRight: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: colors.overlayBorder },
  caseLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  close: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.textPrimary, fontSize: 24 },
});
