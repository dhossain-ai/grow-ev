import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Coordinates } from '../../../../../packages/routing';

import { fetchStationCapacity } from './capacityApi';
import { AlternativeRouting } from './AlternativeRouting';
import { ConnectorSelector, ActionButton } from '../../components/CalmUI';
import { compatibleCapacity, CONGESTION_EXPLANATIONS, findAlternatives,
  type ConnectorStandard, type StationEvidence } from './congestion';
import { colors, spacing } from './tokens';
import type { MapStation } from './types';

interface Props { station: MapStation; onSelect: (station: MapStation) => void; userOrigin?: Coordinates; standard: ConnectorStandard; onStandardChange: (value: ConnectorStandard) => void; onCase: () => void }

export function CongestionDetail({ station, onSelect, userOrigin, standard, onStandardChange, onCase }: Props) {
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
    .filter((time): time is string => Boolean(time)).map((time) => new Date(time).toLocaleString('en-GB', { timeZone: 'Europe/Vilnius', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' Europe/Vilnius').join(' – ');

  return <View style={styles.container}>
    <Text style={styles.title}>Your charging need</Text>
    <ConnectorSelector value={standard} onChange={onStandardChange} />
    {failed ? <>
      <Text accessibilityRole="alert" style={styles.muted}>Compatible capacity could not be checked. Please retry.</Text>
      <ActionButton secondary label="Retry capacity check" onPress={() => setRetry((n) => n + 1)} />
    </> : !capacity ? <Text style={styles.muted}>Checking compatible capacity…</Text> : <>
      <Text style={styles.text}>{capacity.state === 'stale' || capacity.state === 'unknown' ? 'Current availability unverified' : capacity.state === 'no-compatible' ? 'No matching connector here' : capacity.state === 'unavailable' ? 'Compatible chargers are unavailable' : `${capacity.available} compatible EVSE${capacity.available === 1 ? '' : 's'} observed available`}</Text>
      <Text style={styles.muted}>{capacity.state === 'stale' ? 'The saved observations are dated. We can’t verify this connector’s availability right now.' : CONGESTION_EXPLANATIONS[capacity.state]}</Text>
      {capacity.state === 'stale' ? <ActionButton secondary label="Explore the recorded case study" onPress={onCase} /> : null}
      {capacity.unknown > 0 ? <Text style={styles.muted}>{capacity.unknown} compatible EVSE status unknown.</Text> : null}
      <Text style={styles.muted}>Last observed · {observationRange || 'Not reported'}</Text>
      {capacity.state === 'congested' && target ? <>
        <Text style={styles.title}>Where to charge next</Text>
        <AlternativeRouting target={target} standard={standard} alternatives={alternatives} now={now} onSelect={onSelect} userOrigin={userOrigin} />
      </> : null}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  container: { paddingVertical: spacing.md, gap: spacing.sm },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  text: { color: colors.textPrimary, fontSize: 14 },
  muted: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
});
