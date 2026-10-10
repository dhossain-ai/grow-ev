import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CONNECTOR_OPTIONS, type ConnectorStandard } from '../map/congestion';
import { colors, radii, spacing } from '../map/tokens';
import { fetchNetworkEvidence, type NetworkEvidence } from './networkApi';
import { networkOverview, type NetworkPair } from './overview';

const timestamp = (value: number | string | null) => value === null ? 'Not reported' :
  new Date(value).toLocaleString('en-GB', { timeZone: 'Europe/Vilnius', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit' });
const stationName = (pair: NetworkPair, source: boolean) => {
  const station = (source ? pair.source : pair.alternative).station;
  return station.name ?? station.address ?? 'Unnamed location';
};

export function NetworkDashboard() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [standard, setStandard] = useState<ConnectorStandard>('IEC_62196_T2_COMBO');
  const [data, setData] = useState<NetworkEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    fetchNetworkEvidence(controller.signal).then((result) => {
      if (!disposed && !controller.signal.aborted) { setData(result); setNow(Date.now()); }
    }).catch(() => {
      if (!disposed) setError('Network observations could not be loaded. Check your connection and try again.');
    }).finally(() => { clearTimeout(timeout); if (!disposed) setLoading(false); });
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); };
  }, [refresh]);
  // Clock-only freshness re-evaluation. This never fetches data or routes.
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(clock);
  }, []);
  const overview = useMemo(() => networkOverview(data?.records ?? [], standard, now), [data, standard, now]);
  const connector = CONNECTOR_OPTIONS.find((option) => option.value === standard)!.label;
  const pairs = overview.pairs.length ? overview.pairs : overview.historicalPairs;
  const featured = pairs.find((pair) => pair.crossOperator) ?? pairs[0];
  const historical = featured?.historical ?? false;
  const metrics = [
    ['Observed locations', overview.locations, colors.textPrimary],
    ['Distinct EVSEs', overview.evses, colors.textPrimary],
    ['AVAILABLE', overview.available, colors.available],
    ['CHARGING', overview.charging, colors.warning],
    ['UNKNOWN', overview.unknown, colors.textSecondary],
    ['Other unavailable', overview.otherUnavailable, colors.unavailable],
  ] as const;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 220, gap: spacing.sm }}>
          <Text style={styles.eyebrow}>VILNIUS · NETWORK INTELLIGENCE</Text>
          <Text accessibilityRole="header" style={[styles.title, !wide && { fontSize: 28, lineHeight: 34 }]}>Occupied here. Capacity nearby.</Text>
          <Text style={styles.body}>See where compatible spare capacity could balance an occupied location.</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={loading} onPress={() => {
          setLoading(true); setError(null); setData(null); setRefresh((value) => value + 1);
        }} style={styles.button}>
          <Text style={styles.buttonText}>{loading ? 'Loading observations…' : 'Reload saved observations'}</Text>
        </Pressable>
      </View>
      <View style={styles.filters}>
        <Text style={styles.body}>Connector</Text>
        {CONNECTOR_OPTIONS.map((option) => <Pressable key={option.value} accessibilityRole="button"
          accessibilityState={{ selected: standard === option.value }}
          onPress={() => { setStandard(option.value); setNow(Date.now()); }}
          style={[styles.chip, standard === option.value && styles.selectedChip]}>
          <Text style={[styles.body, standard === option.value && { color: colors.accent }]}>{option.label}</Text>
        </Pressable>)}
        <Text style={styles.caption}>One EVSE counted once, even with multiple connectors.</Text>
      </View>
      {loading ? <View style={styles.panel}><Text style={styles.body}>Loading sanitized station evidence…</Text></View> :
        error ? <View style={styles.panel}><Text accessibilityRole="alert" style={styles.warning}>{error}</Text></View> : <>
          <View style={[styles.panel, { borderColor: overview.stale ? colors.warning : colors.overlayBorder }]}>
            <Text style={overview.stale ? styles.warning : styles.positive}>
              {overview.evses === 0 ? 'No compatible observations in the fetched area.' : overview.stale ?
                `Dated observations · ${overview.stale} of ${overview.evses} EVSE observations stale or invalid` : 'Observations within the 60-minute freshness limit'}
            </Text>
            <Text style={styles.body}>{overview.evses > 0 && overview.fresh === 0 ? 'Current availability unverified. All compatible observations are dated.' : `${overview.freshAvailable} fresh AVAILABLE ${connector} EVSEs · ${overview.fresh} fresh observations.`}</Text>
            <Text style={styles.caption}>Observed {timestamp(overview.oldest)} — {timestamp(overview.newest)} Europe/Vilnius.
              {' '}Fetched {timestamp(data?.fetchedAt ?? null)}; fetching does not renew source observations.</Text>
          </View>
          {overview.evses === 0 ? <View style={styles.panel}><Text style={styles.sectionTitle}>No {connector} evidence</Text>
            <Text style={styles.body}>Choose another connector or reload saved observations. No capacity is inferred for missing records.</Text></View> :
            <View style={[styles.columns, wide && { flexDirection: 'row' }]}>
              <View style={[styles.panel, { flex: wide ? 2 : undefined, borderColor: featured ? colors.accent : colors.overlayBorder }]}>
                <Text style={styles.eyebrow}>{historical ? 'DATED SNAPSHOT PATTERN · NOT CURRENT AVAILABILITY' : 'COMPATIBLE CAPACITY OPPORTUNITIES'}</Text>
                <Text accessibilityRole="header" style={styles.sectionTitle}>{featured ? featured.crossOperator ?
                  'A full location. Spare capacity at another operator.' : 'A full location. Spare capacity nearby.' : 'No fresh balancing pair confirmed'}</Text>
                {featured ? <>
                  <PairCard pair={featured} connector={connector} wide={wide} />
                  <Text style={styles.body}>At the evaluated snapshot, {stationName(featured, true)} had no available {connector} EVSEs
                    {' '}and {featured.occupied} charging, blocked or reserved. {stationName(featured, false)} reported
                    {' '}{featured.available} compatible AVAILABLE EVSEs{featured.crossOperator ? ' at a different reported operator' : ''}.</Text>
                  <Text style={styles.caption}>Evaluated {timestamp(featured.evaluatedAt)} Europe/Vilnius.
                    {' '}{historical ? 'Historical evidence illustrates the pattern; refresh source observations before acting.' : 'Availability may change before arrival.'}
                    {' '}Geographic proximity does not establish road reachability. Driving time unavailable; this dashboard requests no routes.</Text>
                </> : <Text style={styles.body}>Congestion needs fresh compatible evidence. UNKNOWN, outages and stale observations cannot confirm current saturation or spare capacity.</Text>}
              </View>
              <View style={[styles.panel, { flex: wide ? 1 : undefined }]}>
                <Text style={styles.eyebrow}>THE NETWORK VIEW</Text>
                <Text style={styles.number}>{overview.pairs.filter((p) => p.crossOperator).length}</Text>
                <Text style={styles.sectionTitle}>fresh cross-operator pairs</Text>
                <Text style={styles.body}>{overview.congestedLocations} locations with fresh compatible congestion.</Text>
                <Text style={styles.body}>{overview.operators} reported operator names in this connector selection.</Text>
                <View style={styles.divider} />
                <Text style={styles.body}>Grow EV links observed pressure to compatible nearby capacity across networks.</Text>
                <Text style={styles.caption}>Pairs are candidate choices, not additive capacity or measured redistribution. No queues, waiting drivers, energy use or revenue inferred.</Text>
              </View>
            </View>}
          <Text style={styles.eyebrow}>LAST OBSERVED STATUS · {connector.toUpperCase()} EVSES</Text>
          <View style={styles.metrics}>
            {metrics.map(([label, value, color]) => <View key={label} style={[styles.metric, { width: wide ? '15.4%' : width >= 550 ? '31%' : '47%' }]}>
              <Text style={[styles.number, { color }]}>{value}</Text><Text style={styles.body}>{label}</Text>
            </View>)}
          </View>
          <Text style={styles.caption}>Status totals include dated observations. Other unavailable includes blocked, reserved, inoperative, out-of-order, planned and removed; UNKNOWN is separate.</Text>
          {pairs.length > 1 ? <View style={styles.panel}>
            <Text style={styles.sectionTitle}>{historical ? 'More dated snapshot pairs' : 'More nearby opportunities'}</Text>
            {pairs.filter((pair) => pair !== featured).slice(0, 5).map((pair) => <View key={`${pair.source.station.location_id}-${pair.alternative.station.location_id}`} style={styles.listRow}>
              <Text style={styles.body}>{stationName(pair, true)} → {stationName(pair, false)}</Text>
              <Text style={styles.caption}>{pair.source.station.operator_name ?? 'Operator not reported'} → {pair.alternative.station.operator_name ?? 'Operator not reported'}
                {' '}· {pair.available} compatible AVAILABLE · {pair.distanceKm.toFixed(2)} km straight-line
                {' '}· {pair.crossOperator ? 'Cross-operator' : 'Same / unreported operator'}</Text>
            </View>)}
            <Text style={styles.caption}>Showing {Math.min(pairs.length, 6)} of {pairs.length} detected pairs; up to three nearest fresh-compatible alternatives per congested location, within 10 km.</Text>
          </View> : null}
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Coverage & evidence</Text>
            <Text style={styles.body}>{data?.records.length ?? 0} locations with detailed EVSE evidence. The map query returned {data?.mappedLocations ?? 0} location records in the area.</Text>
            <Text style={styles.caption}>Vilnius study window: 54.64–54.76° N, 25.20–25.36° E, intersected with the existing 10.1 km evidence radius around
              {' '}{data?.anchor?.name ?? data?.anchor?.address ?? 'the selected central location'}. Connector selection applies to all counts and pairs.</Text>
            <Text style={styles.caption}>Via Lietuva observations · sanitized read-only APIs. This is fetched coverage, not a complete city or nationwide census. Reported operator names do not establish complete operator coverage.</Text>
          </View>
        </>}
    </View>
  </ScrollView>;
}

function PairCard({ pair, connector, wide }: { pair: NetworkPair; connector: string; wide: boolean }) {
  return <View style={[styles.pair, wide && { flexDirection: 'row', alignItems: 'center' }]}>
    <View style={[styles.endpoint, { borderColor: colors.warning }]}>
      <Text style={styles.warning}>NO AVAILABLE {connector.toUpperCase()}</Text>
      <Text style={styles.sectionTitle}>{stationName(pair, true)}</Text>
      <Text style={styles.body}>{pair.source.station.operator_name ?? 'Operator not reported'}</Text>
      <Text style={styles.caption}>{pair.occupied} charging / blocked / reserved EVSEs</Text>
    </View>
    <View style={{ alignItems: 'center', gap: spacing.xs }}>
      <Text style={styles.arrow}>{wide ? '→' : '↓'}</Text>
      <Text style={styles.caption}>{pair.distanceKm.toFixed(2)} km</Text>
      <Text style={styles.caption}>straight-line</Text>
    </View>
    <View style={[styles.endpoint, { borderColor: colors.available }]}>
      <Text style={styles.positive}>{pair.available} COMPATIBLE AVAILABLE</Text>
      <Text style={styles.sectionTitle}>{stationName(pair, false)}</Text>
      <Text style={styles.body}>{pair.alternative.station.operator_name ?? 'Operator not reported'}</Text>
      <Text style={styles.caption}>{connector} EVSEs · {pair.historical ? 'dated snapshot' : 'fresh observations'}</Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.main },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  content: { width: '100%', maxWidth: 1280, alignSelf: 'center', gap: spacing.base },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg, marginVertical: spacing.base },
  eyebrow: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, lineHeight: 19 },
  title: { color: colors.textPrimary, fontSize: 34, lineHeight: 41, fontWeight: '700' },
  sectionTitle: { color: colors.textPrimary, fontSize: 20, lineHeight: 27, fontWeight: '600' },
  body: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  caption: { color: colors.textSecondary, fontSize: 12, lineHeight: 19 },
  warning: { color: colors.warning, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  positive: { color: colors.available, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  button: { backgroundColor: colors.elevated, borderRadius: radii.md, padding: spacing.base, minHeight: 48 },
  buttonText: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
  filters: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  chip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.overlayBorder, borderRadius: radii.full, paddingHorizontal: spacing.base, paddingVertical: spacing.md, minHeight: 44 },
  selectedChip: { borderColor: colors.accent },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.base, gap: spacing.sm, flexGrow: 1 },
  number: { color: colors.textPrimary, fontSize: 38, lineHeight: 46, fontWeight: '700' },
  panel: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.overlayBorder, minWidth: 0 },
  columns: { gap: spacing.base },
  pair: { gap: spacing.base, marginVertical: spacing.sm },
  endpoint: { flex: 1, backgroundColor: colors.elevated, borderRadius: radii.md, padding: spacing.base, gap: spacing.sm, borderLeftWidth: 3, minWidth: 0 },
  arrow: { color: colors.accent, fontSize: 32 },
  divider: { height: 1, backgroundColor: colors.overlayBorder, marginVertical: spacing.sm },
  listRow: { borderTopWidth: 1, borderColor: colors.overlayBorder, paddingTop: spacing.md, gap: spacing.xs },
});
