import type { DrivingRoute } from '../../../../../packages/routing';
import { PredictionOutlook } from '../predictions/PredictionOutlook';
import { ResponsibleCharging } from './ResponsibleCharging';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ActionButton } from '../../components/CalmUI';
import { ConnectorIcon } from '../../components/DriverIcons';
import type { ConnectorStandard, StationEvidence } from '../map/congestion';
import type { Recommendation } from '../map/recommendations';
import { colors } from '../map/tokens';
import { formatAge, formatConnector } from '../map/types';
import { compatibleObservation, compatiblePower, connectorKind, stationTitle } from './presentation';

export function PremiumStationDetails({ evidence, standard, now, recommendation, route, onDirections, onCompare, originKind = 'selected-charger', originLabel, routing = false }: {
  evidence: StationEvidence; standard: ConnectorStandard; now: number; recommendation?: Recommendation; route?: DrivingRoute | null;
  onDirections: () => void; onCompare: () => void;
  originKind?: 'selected-charger' | 'user-origin'; originLabel?: string; routing?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const station = evidence.station;
  route = route ?? recommendation?.route;
  const observation = compatibleObservation(evidence, standard, now);
  const power = compatiblePower(station, standard);
  const address = [station.address, station.city].filter(Boolean).join(', ');
  const copyAddress = async () => {
    try {
      const copied = await Clipboard.setStringAsync(address);
      if (!copied) { setCopyMessage('Select and copy the address below.'); return; }
      setCopyMessage('Address copied');
    } catch { setCopyMessage('Select and copy the address below.'); }
  };
  return <View style={{ gap: 12 }}>
    <View><Text accessibilityRole="header" style={styles.title}>{stationTitle(station)}</Text><Text style={styles.body}>Operated by {station.operator_name || 'an unreported operator'}</Text></View>
    {!expanded ? <>
      <View style={styles.box}><View style={styles.row}><ConnectorIcon combo={standard === 'IEC_62196_T2_COMBO'} /><View style={{ flex: 1 }}><Text style={styles.power}>{power === null ? 'Power not reported' : `Up to ${power} kW`}</Text><Text style={styles.body}>{formatConnector(standard)} · {connectorKind(standard)}</Text></View></View><Text style={styles.body}>{observation.compatible} compatible charging point{observation.compatible === 1 ? '' : 's'}</Text></View>
      <View style={styles.box}><Text style={styles.heading}>Charging availability</Text><Text style={styles.body}>{observation.label}</Text><Text style={styles.caption}>Observed {formatAge(observation.observedAt)}{observation.stale ? ' · Stale observation' : ''}</Text></View>
      <View style={styles.box}><Text style={styles.heading}>{route ? `${Math.ceil(route.drivingDurationSeconds / 60)} min drive` : routing ? 'Checking driving time…' : 'Driving time unavailable'}</Text><Text style={styles.caption}>{route ? `TomTom road estimate · from ${originLabel ?? (originKind === 'user-origin' ? 'your requested location' : 'selected charger')}` : 'Use external navigation for turn-by-turn directions.'}</Text></View>
      <ActionButton label="Get directions  →" onPress={onDirections} />
      <ActionButton label="Compare alternatives" secondary onPress={onCompare} />
    </> : null}
    <PredictionOutlook evidence={evidence} standard={standard} now={now} />
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={styles.disclosure}><Text style={styles.heading}>More station information</Text><Text style={styles.heading}>{expanded ? '⌃' : '›'}</Text></Pressable>
    {expanded ? <>
      <Text style={styles.label}>CHARGING EQUIPMENT</Text><View style={styles.box}>{(station.connector_types ?? []).map((connector) => <View key={connector} style={styles.between}><Text style={styles.body}>{formatConnector(connector)}</Text><Text style={styles.body}>{compatiblePower(station, connector) === null ? 'Power not reported' : `Up to ${compatiblePower(station, connector)} kW`}</Text><Text style={styles.caption}>{new Set(evidence.evses.filter((evse) => evse.connector_standards.includes(connector)).map((evse) => evse.id)).size} distinct points</Text></View>)}
        {station.max_power_kw !== null && power === null ? <Text style={styles.caption}>Site maximum: {station.max_power_kw} kW. Connector-specific power is not supplied.</Text> : null}</View>
      <Text style={styles.label}>COMPATIBLE CHARGING POINT STATUS</Text><View style={styles.box}>{Object.entries(observation.breakdown).map(([status, count]) => <View key={status} style={styles.between}><Text style={styles.body}>{status.replace('OUTOFORDER', 'OUT OF ORDER')}</Text><Text style={styles.body}>{count} last observed</Text></View>)}</View>
      <Text style={styles.label}>LOCATION</Text><View style={styles.box}><Text selectable style={styles.body}>{address || 'Address not reported'}</Text>{address ? <ActionButton secondary label="Copy address" onPress={() => { void copyAddress(); }} /> : null}{copyMessage ? <Text accessibilityLiveRegion="polite" style={styles.caption}>{copyMessage}</Text> : null}<Text style={styles.body}>Operator · {station.operator_name || 'Not reported'}</Text></View>
      <Text style={styles.label}>CHARGING DATA</Text><View style={styles.box}><Text style={styles.body}>Source · Via Lietuva OCPI</Text><Text selectable style={styles.body}>Oldest compatible observation · {observation.observedAt ? new Date(observation.observedAt).toLocaleString() : 'Not reported'}</Text><Text style={styles.caption}>Charging conditions can change after observation.</Text></View>
    </> : null}
    {expanded ? <><ResponsibleCharging key={station.location_id} station={station} /><ActionButton label="Get directions  →" onPress={onDirections} /></> : null}
  </View>;
}
const styles = StyleSheet.create({
  title: { fontSize: 28, lineHeight: 33, color: colors.textPrimary, fontWeight: '700', letterSpacing: -.8 },
  body: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  heading: { fontSize: 17, lineHeight: 23, color: colors.textPrimary, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 18, color: colors.textMuted },
  power: { fontSize: 23, lineHeight: 29, color: colors.textPrimary, fontWeight: '700' },
  box: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.overlayBorder, gap: 8 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  between: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  disclosure: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.overlayBorder },
  label: { fontSize: 11, letterSpacing: 1.5, color: colors.textSecondary, marginTop: 4 },
});
