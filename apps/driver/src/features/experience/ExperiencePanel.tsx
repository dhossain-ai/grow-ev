import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useHydratedWindowDimensions } from '../../components/useHydratedWindowDimensions';
import type { Coordinates } from '../../../../../packages/routing';
import { ActionButton, CardReveal, ConnectorSelector } from '../../components/CalmUI';
import { ConnectorIcon } from '../../components/DriverIcons';
import type { ConnectorStandard } from '../map/congestion';
import { colors } from '../map/tokens';
import { formatConnector, type BoundingBox, type MapStation, type StationFilters } from '../map/types';
import { executeVoiceCommand } from '../voice/actions';
import { VoiceControl } from '../voice/VoiceControl';
import { connectorKind, navigationUrls, stationTitle } from './presentation';
import { PremiumStationCard } from './PremiumStationCard';
import { PremiumStationDetails } from './PremiumStationDetails';
import { useDriverSearch } from './useDriverSearch';

type Screen = 'home' | 'results' | 'compare' | 'details';
export function ExperiencePanel({ selected, standard, onStandardChange, onClose, onHighlight, onPresentationChange,
  bounds, onFiltersChange, onLocate, onWiden, filterRequest, onCollapseChange }: {
  selected: MapStation | null; standard: ConnectorStandard; onStandardChange: (value: ConnectorStandard) => void;
  onClose: () => void; onHighlight: (station: MapStation | null) => void; onPresentationChange: (expanded: boolean) => void;
  bounds: BoundingBox | null; onFiltersChange: (filters: StationFilters) => void;
  onLocate: (signal: AbortSignal) => Promise<Coordinates | null>; onWiden: () => void; filterRequest: number;
  onCollapseChange?: (collapsed: boolean) => void;
}) {
  const [screen, setScreen] = useState<Screen>('home');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [userSelected, setUserSelected] = useState(false);
  const compactViewport = useHydratedWindowDimensions().height < 700;
  const search = useDriverSearch(standard, bounds);
  const operations = useRef(search);
  useEffect(() => { operations.current = search; }, [search]);
  const onActiveChange = useCallback((active: boolean) => { setVoiceActive(active); if (active) setCollapsed(false); }, []);
  const scroll = useRef<ScrollView>(null);
  const home = screen === 'home' && search.phase === 'idle';
  const changeConnector = (connector: ConnectorStandard) => {
    operations.current.reset(); onClose(); onHighlight(null); setFocusId(null); setUserSelected(false); setScreen('home'); setCollapsed(false);
    onStandardChange(connector); onFiltersChange({ connectorStandards: [connector] });
  };
  const close = useCallback(() => { operations.current.reset(); onClose(); onHighlight(null); setFocusId(null); setUserSelected(false); setScreen('home'); setCollapsed(false); }, [onClose, onHighlight]);
  const lastFilterRequest = useRef(filterRequest);
  useEffect(() => {
    if (lastFilterRequest.current === filterRequest) return;
    lastFilterRequest.current = filterRequest;
    // The external map Filters button explicitly requests the connector sheet.
    close();
  }, [filterRequest, close]);
  // Map selection is an external event that starts a new asynchronous evidence request.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!selected) return; setScreen('details'); setCollapsed(false); setFocusId(selected.location_id); setUserSelected(true); void operations.current.search({ station: selected }); }, [selected]);
  useEffect(() => { onPresentationChange((!home || voiceActive) && !collapsed); }, [home, voiceActive, collapsed, onPresentationChange]);
  useEffect(() => { onCollapseChange?.(collapsed); }, [collapsed, onCollapseChange]);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [screen, focusId]);
  useEffect(() => {
    if (Platform.OS !== 'android' || home || voiceActive) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (screen === 'details' || screen === 'compare') setScreen('results'); else close(); return true; });
    return () => subscription.remove();
  }, [screen, home, close, voiceActive]);
  const ranked = search.result?.recommendations ?? [];
  const options = search.options;
  const featured = screen === 'compare' ? options[0] : search.rows.find((row) => row.station.location_id === focusId) ?? options[0];
  const highlighted = featured?.station;
  useEffect(() => { if (search.phase === 'ready' && highlighted) onHighlight(highlighted); }, [highlighted, search.phase, onHighlight]);
  const find = async (options?: Parameters<typeof search.search>[0]) => { setCollapsed(false); setScreen('results'); setFocusId(null); setUserSelected(Boolean(options?.station)); return operations.current.search({ ...options, withDrivingTimes: Platform.OS === 'web' }); };
  const directions = async (station: MapStation) => {
    setNavigationError(null);
    try {
      const ios = Platform.OS === 'ios' || (Platform.OS === 'web' && /iPhone|iPad/.test(navigator.userAgent));
      const urls = navigationUrls(station, ios ? 'ios' : Platform.OS === 'android' ? 'android' : 'web');
      for (const url of urls) {
        try { await Linking.openURL(url); return; } catch { /* Try the browser fallback. */ }
      }
      throw new Error('Navigation could not open. Retry or copy the station address in More station information.');
    } catch (failure) { setNavigationError(failure instanceof Error ? failure.message : 'Navigation unavailable. Please retry.'); }
  };
  const chip = <View style={styles.chip}><ConnectorIcon combo={standard === 'IEC_62196_T2_COMBO'} /><Text style={styles.chipText}>{formatConnector(standard)} · {connectorKind(standard)}</Text></View>;
  const isUserOrigin = search.result?.originKind === 'user-origin';
  const originKindType: 'user' | 'selected' | 'demo' = isUserOrigin ? 'user' : userSelected ? 'selected' : 'demo';
  const originBadge = originKindType === 'user' ? 'My location' : originKindType === 'selected' ? 'Selected charger' : 'Demo origin';
  const originName = originKindType === 'user' ? 'Your current location' : search.anchor ? stationTitle(search.anchor.station) : 'Selected charger';
  const originLabel = originKindType === 'user' ? 'your requested location' : search.anchor ? stationTitle(search.anchor.station) : 'selected charger';
  const changeOrigin = async () => {
    if (originKindType === 'user') {
      operations.current.clearUserOrigin();
      if (search.anchor) {
        void operations.current.compareDriving({ lat: search.anchor.station.latitude, lng: search.anchor.station.longitude });
      }
    } else {
      const fix = await onLocate(new AbortController().signal);
      if (fix) await operations.current.compareDriving(fix);
    }
  };
  const compare = () => { setScreen('compare'); if (Platform.OS === 'web' && !options.some(row => search.routeFor(row.station))) void search.compareDriving(); };
  const details = (station: MapStation) => { setFocusId(station.location_id); setScreen('details'); setCollapsed(false); onHighlight(station); };
  return <View style={styles.panel}>
    <Pressable accessibilityRole="button" disabled={voiceActive} accessibilityState={{ disabled: voiceActive }} accessibilityLabel={collapsed ? 'Expand charging sheet' : 'Collapse charging sheet'} onPress={() => setCollapsed((value) => !value)} style={[styles.handleButton, collapsed && { height: 48 }]}><View style={styles.handle} /></Pressable>
    {collapsed ? null : <CardReveal key={`${screen}-${search.phase}`} aria-hidden={voiceActive} accessibilityElementsHidden={voiceActive} importantForAccessibility={voiceActive ? 'no-hide-descendants' : 'auto'} pointerEvents={voiceActive ? 'none' : 'auto'} style={{ flex: 1 }}>
      {home ? <View style={[styles.home, compactViewport && { gap: 10, paddingBottom: 14 }]}>
        <Text accessibilityRole="header" style={[styles.title, compactViewport && { fontSize: 24, lineHeight: 28 }]}>Find your next charge</Text>
        <Text style={[styles.body, compactViewport && { fontSize: 13, lineHeight: 18 }]}>Choose your connector to explore compatible charging options.</Text>
        {Platform.OS === 'web' ? <Text style={styles.caption}>Driving estimates start at the selected charger.</Text> : null}
        <ConnectorSelector value={standard} onChange={changeConnector} />
        <View style={{ paddingRight: 68 }}><ActionButton label="Find charging options  →" onPress={() => { void find(); }} /></View>
      </View> : <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.toolbar}><Pressable accessibilityRole="button" style={styles.touch} onPress={() => { if (screen === 'details' || screen === 'compare') setScreen('results'); else close(); }}><Text style={styles.body}>‹  Back</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Close charging results" style={styles.touch} onPress={close}><Text style={styles.close}>×</Text></Pressable></View>
        {search.phase === 'loading' ? <><Text accessibilityRole="header" style={styles.title}>Finding your charging options</Text>{chip}<Text style={styles.body}>Checking compatible chargers nearby.</Text><ActivityIndicator accessibilityLabel="Loading compatible charging data" color={colors.accentInk} />{[0, 1, 2].map((i) => <View key={i} style={styles.skeleton}><View style={styles.skeletonDot} /><View style={{ flex: 1, gap: 9 }}><View style={styles.skeletonLine} /><View style={[styles.skeletonLine, { width: '60%' }]} /></View></View>)}</> : search.phase === 'error' ? <><Text accessibilityRole="header" style={styles.title}>Charging data unavailable</Text><Text accessibilityRole="alert" style={styles.body}>{search.error}</Text>{chip}<ActionButton label="Try again  →" onPress={() => { void find(); }} /><ActionButton secondary label="Change connector" onPress={close} /></> : search.phase === 'empty' || !featured ? <><Text accessibilityRole="header" style={styles.title}>No matching chargers nearby</Text><Text style={styles.body}>Try a wider area or change your connector.</Text>{chip}<ActionButton label="Search a wider area  →" onPress={() => { onWiden(); close(); }} /><ActionButton secondary label="Change connector" onPress={close} /></> : screen === 'details' ? <PremiumStationDetails route={search.routeFor(featured.station)} originKind={search.result?.originKind} originLabel={originLabel} originStationId={search.anchor?.station.location_id} displayOrigin={search.displayOrigin} routing={search.routing} key={`${featured.station.location_id}-${standard}`} evidence={featured} standard={standard} now={search.now}
          recommendation={ranked.find((item) => item.evidence.station.location_id === featured.station.location_id)} onDirections={() => { void directions(featured.station); }} onCompare={compare} /> : <>
          <Text accessibilityRole="header" style={styles.title}>{screen === 'compare' ? 'Compare charging options' : 'Charging options nearby'}</Text>
          <View style={styles.toolbar}>{chip}<Pressable accessibilityRole="button" style={styles.touch} onPress={close}><Text style={styles.body}>Change ›</Text></Pressable></View>
          <View style={styles.originCard}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.originSub}>Starting from:</Text>
              <View style={styles.originRow}>
                <View style={[styles.originBadge, originKindType === 'user' ? styles.originBadgeUser : originKindType === 'selected' ? styles.originBadgeSelected : styles.originBadgeDemo]}>
                  <Text style={[styles.originBadgeText, originKindType === 'user' ? styles.originBadgeTextUser : styles.originBadgeTextDefault]}>
                    {originBadge}
                  </Text>
                </View>
                <Text numberOfLines={1} style={styles.originName}>{originName}</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Change starting origin" onPress={() => { void changeOrigin(); }} style={styles.changeOriginTouch}>
              <Text style={styles.changeOriginText}>Change ›</Text>
            </Pressable>
          </View>
          {ranked.length ? <Text style={styles.caption}>{search.result?.rankingBasis === 'driving-time' ? 'Shortest estimated drive first.' : 'Nearest eligible alternatives.'}</Text> : <Text style={styles.caption}>Compatible charging stations nearby</Text>}
          <PremiumStationCard route={search.routeFor(featured.station)} originKind={search.result?.originKind} originLabel={originLabel} originStationId={search.anchor?.station.location_id} displayOrigin={search.displayOrigin} routing={search.routing} evidence={featured} standard={standard} now={search.now} featured recommendation={ranked.find((item) => item.evidence.station.location_id === featured.station.location_id)} onDetails={() => details(featured.station)} onDirections={() => { void directions(featured.station); }} />
          {screen !== 'compare' ? <ActionButton secondary label="Compare alternatives" onPress={compare} /> : null}
          {screen === 'compare' || Platform.OS === 'web' ? options.filter((row) => row.station.location_id !== featured.station.location_id).slice(0, 2).map((row) => <PremiumStationCard route={search.routeFor(row.station)} originKind={search.result?.originKind} originLabel={originLabel} originStationId={search.anchor?.station.location_id} displayOrigin={search.displayOrigin} routing={search.routing} key={row.station.location_id} evidence={row} standard={standard} now={search.now} recommendation={ranked.find((item) => item.evidence.station.location_id === row.station.location_id)} onDetails={() => details(row.station)} onDirections={() => { void directions(row.station); }} />) : null}
          {options.length ? <ActionButton secondary disabled={search.routing || search.now < search.retryAt} label={search.routing ? 'Checking driving times…' : search.now < search.retryAt ? 'Routing rate limited · try later' : 'Compare driving times'} onPress={() => { setScreen('compare'); void search.compareDriving(); }} /> : null}
          <ActionButton secondary disabled={search.routing || search.now < search.retryAt} label="Driving times from my location" onPress={() => { void (async () => { const fix = await onLocate(new AbortController().signal); if (fix) await operations.current.compareDriving(fix); })(); }} />
          {search.error ? <Text accessibilityRole="alert" style={styles.caption}>{search.error}</Text> : null}
          <Text style={styles.caption}>Availability is last observed and can change before arrival.</Text>
        </>}
        {navigationError ? <Text accessibilityRole="alert" style={styles.body}>{navigationError}</Text> : null}
      </ScrollView>}
    </CardReveal>}
    <VoiceControl hideTrigger={!home || collapsed} onActiveChange={onActiveChange} onCommand={(command, signal) => executeVoiceCommand(command, signal, {
      standard, locate: () => onLocate(signal), selectConnector: changeConnector,
      search: (options) => find(options), alternatives: async () => { if (!ranked.length) return false; setScreen('compare'); return true; },
    })} />
  </View>;
}
const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.main, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', boxShadow: `0 -2px 24px ${colors.shadow}` },
  handleButton: { height: 28, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 44, height: 5, borderRadius: 4, backgroundColor: '#D3D7D3' },
  home: { flex: 1, paddingHorizontal: 20, paddingBottom: 20, gap: 14, justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 24, gap: 12 },
  title: { color: colors.textPrimary, fontSize: 27, fontWeight: '700', lineHeight: 32, letterSpacing: -.9 },
  body: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  caption: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  drive: { color: colors.accentInk, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  touch: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  close: { fontSize: 30, color: colors.textPrimary },
  chip: { backgroundColor: colors.accentSoft, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipText: { color: colors.textPrimary, fontSize: 13 },
  skeleton: { height: 72, borderRadius: 16, borderWidth: 1, borderColor: colors.overlayBorder, padding: 14, flexDirection: 'row', gap: 14, alignItems: 'center' },
  skeletonDot: { width: 36, height: 36, borderRadius: 20, backgroundColor: colors.elevated },
  skeletonLine: { height: 9, width: '90%', backgroundColor: '#E3E8E3', borderRadius: 6 },
  originCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.overlayBorder, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  originSub: { color: colors.textSecondary, fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  originRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  originBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  originBadgeUser: { backgroundColor: colors.accentSoft },
  originBadgeSelected: { backgroundColor: colors.elevated },
  originBadgeDemo: { backgroundColor: colors.elevated },
  originBadgeText: { fontSize: 11, fontWeight: '600' },
  originBadgeTextUser: { color: colors.accentInk },
  originBadgeTextDefault: { color: colors.textSecondary },
  originName: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  changeOriginTouch: { minHeight: 36, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  changeOriginText: { color: colors.accentInk, fontSize: 13, fontWeight: '600' },
});
