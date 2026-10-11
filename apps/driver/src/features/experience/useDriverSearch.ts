import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Coordinates, RouteOutcome } from '../../../../../packages/routing';
import { fetchMapStations } from '../map/api';
import { fetchStationCapacity } from '../map/capacityApi';
import { compatibleCapacity, type ConnectorStandard, type StationEvidence } from '../map/congestion';
import { recommendAlternatives } from '../map/recommendations';
import { fetchDrivingRoutes, RoutingClientError } from '../map/routingApi';
import type { BoundingBox, MapStation } from '../map/types';
import { compatiblePower, searchAnchor, searchOptions, displayedRoute } from './presentation';

export type SearchPhase = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
export function useDriverSearch(standard: ConnectorStandard, bounds: BoundingBox | null) {
  const [phase, setPhase] = useState<SearchPhase>('idle');
  const [rows, setRows] = useState<StationEvidence[]>([]);
  const [anchor, setAnchor] = useState<StationEvidence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, RouteOutcome>>({});
  const [routing, setRouting] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [searchOrigin, setSearchOrigin] = useState<Coordinates | undefined>();
  const [originAt, setOriginAt] = useState(0);
  const [minimumPower, setMinimumPower] = useState<number | undefined>();
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { controller.current?.abort(); setSearchOrigin(undefined); setOutcomes({}); setRouting(false); }
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => { clearInterval(timer); controller.current?.abort(); }; }, []);
  const reset = useCallback(() => { generation.current++; controller.current?.abort(); setPhase('idle'); setRows([]); setAnchor(null); setSearchOrigin(undefined); setOutcomes({}); setError(null); setRouting(false); }, []);

  const search = async (options: { station?: MapStation; connector?: ConnectorStandard; origin?: Coordinates; minPowerKw?: number; signal?: AbortSignal } = {}) => {
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    const id = ++generation.current;
    const cancel = () => current.abort();
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) current.abort();
    const timer = setTimeout(cancel, 15000);
    setPhase('loading'); setError(null); setOutcomes({}); setRouting(false);
    try {
      const connector = options.connector ?? standard;
      const area: BoundingBox = options.origin ? [options.origin.lng - .12, options.origin.lat - .08, options.origin.lng + .12, options.origin.lat + .08] : bounds ?? [25.15, 54.6, 25.4, 54.8];
      const center = options.origin ?? { lat: (area[1] + area[3]) / 2, lng: (area[0] + area[2]) / 2 };
      const station = options.station ?? searchAnchor(await fetchMapStations(area, { connectorStandards: [connector], minPowerKw: options.minPowerKw }, current.signal), connector, center, options.minPowerKw);
      if (current.signal.aborted) throw new Error('Charging search interrupted. Please retry.');
      if (!station) { if (id === generation.current) { setRows([]); setAnchor(null); setPhase('empty'); } return false; }
      const evidence = await fetchStationCapacity(station.location_id, current.signal);
      if (current.signal.aborted) throw new Error('Charging search interrupted. Please retry.');
      if (id !== generation.current) return false;
      if (!evidence.some((row) => compatibleCapacity(row, connector, Date.now()).compatible > 0 &&
          (options.minPowerKw === undefined || (compatiblePower(row.station, connector) ?? -1) >= options.minPowerKw))) {
        setRows([]); setAnchor(null); setPhase('empty'); return false;
      }
      setRows(evidence); setAnchor(evidence.find((row) => row.station.location_id === station.location_id)!);
      setSearchOrigin(options.origin); setOriginAt(Date.now()); setMinimumPower(options.minPowerKw);
      setNow(Date.now()); setPhase('ready'); return true;
    } catch (failure) {
      if (id === generation.current) { setPhase('error'); setError(failure instanceof Error ? failure.message : 'Charging data unavailable. Please retry.'); }
      return false;
    } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', cancel); }
  };
  const suitableRows = rows.filter((row) => minimumPower === undefined || (compatiblePower(row.station, standard) ?? -1) >= minimumPower);
  const effectiveOrigin = searchOrigin && now - originAt <= 120000 ? searchOrigin : undefined;
  const displayOrigin = effectiveOrigin ?? (anchor ? { lat: anchor.station.latitude, lng: anchor.station.longitude } : null);
  const result = anchor ? recommendAlternatives(anchor, suitableRows, standard, now, outcomes, effectiveOrigin) : null;
  const options = result?.recommendations.length ? result.recommendations.map(item => item.evidence) : displayOrigin ? searchOptions(suitableRows, standard, displayOrigin) : [];
  const routeFor = (station: MapStation) => displayOrigin && (!searchOrigin || effectiveOrigin) ? displayedRoute(outcomes[station.location_id], station, displayOrigin, now) : null;
  const compareDriving = async (origin?: Coordinates) => {
    if (!anchor || !options.length || routing || now < retryAt) return;
    if (searchOrigin && !effectiveOrigin && !origin) { setError('Location expired. Request your location again.'); return; }
    const routeOrigin = origin ?? effectiveOrigin ?? { lat: anchor.station.latitude, lng: anchor.station.longitude };
    const candidates = (result?.recommendations.length ? options : searchOptions(suitableRows, standard, routeOrigin))
      .filter(row => row.station.latitude !== routeOrigin.lat || row.station.longitude !== routeOrigin.lng);
    if (!candidates.length) { setError('Request your location to calculate a drive to this charger.'); return; }
    const id = generation.current;
    const current = new AbortController(); controller.current = current;
    const timer = setTimeout(() => current.abort(), 12000);
    setRouting(true); setError(null); setOutcomes({});
    try {
      const routes = await fetchDrivingRoutes({ origin: routeOrigin,
        destinations: candidates.map((item) => ({ lat: item.station.latitude, lng: item.station.longitude })) }, current.signal);
      if (id !== generation.current) return;
      if (current.signal.aborted) throw new Error('Routing interrupted');
      if (origin) { setSearchOrigin(origin); setOriginAt(Date.now()); }
      setOutcomes(Object.fromEntries(candidates.map((item, i) => [item.station.location_id, routes[i]])));
      if (routes.some(route => 'error' in route)) setError('Some driving times are unavailable. External navigation remains available.');
      if (routes.some((route) => 'error' in route && ['RATE_LIMITED', 'EXTERNAL_RATE_LIMITED'].includes(route.error.code))) setRetryAt(Date.now() + 60000);
      setNow(Date.now());
    } catch (failure) {
      if (id === generation.current) {
        setError(current.signal.aborted ? 'Driving time request timed out. Retry or use external navigation.' : failure instanceof Error ? failure.message : 'Driving time unavailable');
        if (failure instanceof RoutingClientError && failure.retryAfterSeconds) setRetryAt(Date.now() + failure.retryAfterSeconds * 1000);
      }
    } finally { clearTimeout(timer); if (id === generation.current) setRouting(false); }
  };
  return { phase, rows: suitableRows, options, routeFor, anchor, result, now, error, search, reset, routing, compareDriving, retryAt };
}
