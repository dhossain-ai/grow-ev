import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchStationCapacity } from './capacityApi';
import { AlternativeRouting } from './AlternativeRouting';
import { compatibleCapacity, CONNECTOR_OPTIONS, CONGESTION_EXPLANATIONS, findAlternatives,
  type ConnectorStandard, type StationEvidence } from './congestion';
import { colors, radii, spacing } from './tokens';
import { formatAge, type MapStation } from './types';

interface Props { station: MapStation; onSelect: (station: MapStation) => void }

export function CongestionDetail({ station, onSelect }: Props) {
  const [standard, setStandard] = useState<ConnectorStandard>('IEC_62196_T2_COMBO');
  const [result, setResult] = useState<{ id: string; retry: number; rows: StationEvidence[] } | null>(null);
  const [failure, setFailure] = useState<{ id: string; retry: number } | null>(null);
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(Date.now);
  const locationId = station.location_id;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let active = true;
    fetchStationCapacity(locationId, controller.signal).then((rows) => {
      if (!controller.signal.aborted) { setResult({ id: locationId, retry, rows }); setNow(Date.now()); }
    }).catch(() => {
      // A timeout is visible; cancellation on station switch does not set state.
      if (active) setFailure({ id: locationId, retry });
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [locationId, retry]);

  const rows = result?.id === locationId && result.retry === retry ? result.rows : null;
  const failed = failure?.id === locationId && failure.retry === retry && !rows;
  const target = rows?.find((r) => r.station.location_id === locationId);
  const capacity = target ? compatibleCapacity(target, standard, now) : null;
  const alternatives = target && rows ? findAlternatives(target, rows, standard, now) : [];
  const observationTimes = target?.evses.filter((e) => e.connector_standards.includes(standard))
    .map((e) => e.observed_at).sort((a, b) => Date.parse(a) - Date.parse(b)) ?? [];
  const observationRange = [...new Set([observationTimes[0], observationTimes[observationTimes.length - 1]])]
    .filter((time): time is string => Boolean(time)).map((time) => new Date(time).toLocaleString()).join(' – ');

  return <View style={styles.container}>
    <Text style={styles.title}>Your connector</Text>
    <View style={styles.row}>
      {CONNECTOR_OPTIONS.map((option) => <Pressable key={option.value}
        accessibilityRole="button" accessibilityLabel={`Use ${option.label}`}
        accessibilityState={{ selected: standard === option.value }}
        onPress={() => setStandard(option.value)}
        style={[styles.chip, standard === option.value && styles.selected]}>
        <Text style={[styles.text, standard === option.value && styles.selectedText]}>{option.label}</Text>
      </Pressable>)}
    </View>
    {failed ? <>
      <Text accessibilityRole="alert" style={styles.muted}>Compatible capacity could not be checked. Please retry.</Text>
      <Pressable accessibilityRole="button" onPress={() => setRetry((n) => n + 1)}><Text style={styles.action}>Retry capacity check</Text></Pressable>
    </> : !capacity ? <Text style={styles.muted}>Checking compatible capacity…</Text> : <>
      <Text style={styles.text}>{capacity.available} compatible available EVSE{capacity.available === 1 ? '' : 's'} · fresh observations</Text>
      <Text style={styles.muted}>{CONGESTION_EXPLANATIONS[capacity.state]}</Text>
      {capacity.unknown > 0 ? <Text style={styles.muted}>{capacity.unknown} compatible EVSE status unknown.</Text> : null}
      {capacity.stale > 0 ? <Text style={styles.warning}>{capacity.stale} compatible observations stale or invalid; excluded from availability.</Text> : null}
      <Text style={styles.muted}>Compatible EVSEs observed: {observationRange || 'Not reported'}</Text>
      {capacity.state === 'congested' ? <>
        <Text style={styles.title}>Nearby alternatives</Text>
        <Text style={styles.muted}>Within 10 km · nearest first · straight-line distance</Text>
        {!alternatives.length ? <Text style={styles.muted}>No nearby station has fresh, compatible available capacity.</Text> : null}
        <AlternativeRouting station={station} alternatives={alternatives} now={now} />
        {alternatives.map((a) => <Pressable key={a.evidence.station.location_id}
          accessibilityRole="button" accessibilityLabel={`Select ${a.evidence.station.name ?? a.evidence.station.address ?? 'alternative station'}`}
          onPress={() => onSelect(a.evidence.station)} style={styles.alternative}>
          <Text style={styles.text}>{a.evidence.station.name ?? a.evidence.station.address ?? 'Charging station'}</Text>
          <Text style={styles.muted}>{a.evidence.station.operator_name ?? 'Operator not reported'}</Text>
          <Text style={styles.action}>{a.capacity.available} compatible available EVSE{a.capacity.available === 1 ? '' : 's'} · {a.distanceKm.toFixed(1)} km straight-line</Text>
          <Text style={styles.muted}>Available capacity observed {formatAge(a.capacity.observedAt)} · {a.capacity.observedAt ? new Date(a.capacity.observedAt).toLocaleString() : ''}</Text>
          <Text style={styles.action}>Select station →</Text>
        </Pressable>)}
      </> : null}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  container: { paddingVertical: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  text: { color: colors.textPrimary, fontSize: 14 },
  muted: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  warning: { color: colors.warning, fontSize: 13 },
  action: { color: colors.accent, fontSize: 13, lineHeight: 20 },
  chip: { backgroundColor: colors.elevated, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  selected: { backgroundColor: colors.accent },
  selectedText: { color: colors.accentForeground },
  alternative: { backgroundColor: colors.elevated, borderRadius: radii.md, padding: spacing.md, gap: spacing.xs },
});
