import { Map, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';

import 'maplibre-gl/dist/maplibre-gl.css';
import './calm.web.css';
import { Pressable, Text, useWindowDimensions } from 'react-native';

import { ExperiencePanel } from '../features/experience/ExperiencePanel';
import { useReducedMotion } from './CalmUI';
import type { ConnectorStandard } from '../features/map/congestion';
import { useUserLocation } from '../features/location/useUserLocation';
import { LocationControl } from '../features/location/LocationControl';
import {
  MAP_ERROR_BACKGROUND_COLOR,
  MAP_ERROR_TEXT_COLOR,
  PREMIUM_MAP_STYLE,
  VILNIUS_CENTER,
  VILNIUS_INITIAL_ZOOM,
} from './mapConfig';
import {
  MapStatus,
  useMapStations,
  availabilityColors,
  colors,
} from '../features/map';
import type { BoundingBox, MapStation, StationFilters } from '../features/map';

setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

const STATIONS_SOURCE = 'stations';
const CLUSTER_LAYER = 'station-clusters';
const CLUSTER_COUNT_LAYER = 'cluster-count';
const UNCLUSTERED_LAYER = 'unclustered-station';
const UNCLUSTERED_HALO_LAYER = 'unclustered-station-halo';

export function GrowMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<Marker | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [hasLoadingError, setHasLoadingError] = useState(false);
  const [bounds, setBounds] = useState<BoundingBox | null>(null);
  const [selectedStation, setSelectedStation] = useState<MapStation | null>(null);
  const location = useUserLocation();
  const [expanded, setExpanded] = useState(false);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const reduced = useReducedMotion();
  const layoutRef = useRef({ wide, reduced });
  useEffect(() => { layoutRef.current = { wide, reduced }; }, [wide, reduced]);
  const [standard, setStandard] = useState<ConnectorStandard>('IEC_62196_T2_COMBO');
  const [highlightedStation, setHighlightedStation] = useState<MapStation | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [filterRequest, setFilterRequest] = useState(0);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [panelHeight, setPanelHeight] = useState(0);
  const [filters, setFilters] = useState<StationFilters>({ connectorStandards: ['IEC_62196_T2_COMBO'] });
  const { geojson, stations, loading, error, lastFetched, refresh } =
    useMapStations(bounds, filters);

  const updateBounds = useCallback((map: Map) => {
    const b = map.getBounds();
    setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new Map({
      attributionControl: {},
      center: VILNIUS_CENTER,
      container: containerRef.current,
      style: JSON.parse(PREMIUM_MAP_STYLE) as StyleSpecification,
      zoom: VILNIUS_INITIAL_ZOOM,
    });

    mapRef.current = map;

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      setHasLoadingError(false);
      updateBounds(map);

      // Add station source with clustering
      map.addSource(STATIONS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Cluster circles
      map.addLayer({
        id: CLUSTER_LAYER,
        type: 'circle',
        source: STATIONS_SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            colors.cluster,
            10, colors.cluster,
            50, colors.cluster,
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            14,
            10, 18,
            50, 22,
          ],
          'circle-opacity': 0.85,
          'circle-stroke-width': 2,
          'circle-stroke-color': colors.overlayBorder,
        },
      });

      // Cluster count labels
      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: 'symbol',
        source: STATIONS_SOURCE,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 13,
          'text-font': ['Noto Sans Regular'],
        },
        paint: {
          'text-color': colors.textPrimary,
        },
      });

      // Individual station outline
      map.addLayer({
        id: UNCLUSTERED_HALO_LAYER,
        type: 'circle',
        source: STATIONS_SOURCE,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match',
            ['get', 'availability'],
            'available', availabilityColors.available,
            'occupied', availabilityColors.occupied,
            'unavailable', availabilityColors.unavailable,
            availabilityColors.unknown,
          ],
          'circle-radius': 14,
          'circle-opacity': 0.15,
        },
      });

      // Individual station markers
      map.addLayer({
        id: UNCLUSTERED_LAYER,
        type: 'circle',
        source: STATIONS_SOURCE,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match',
            ['get', 'availability'],
            'available', availabilityColors.available,
            'occupied', availabilityColors.occupied,
            'unavailable', availabilityColors.unavailable,
            availabilityColors.unknown,
          ],
          'circle-radius': 11,
          'circle-stroke-width': 2,
          'circle-stroke-color': colors.overlayBorder,
        },
      });

      map.addLayer({ id: 'charging-symbol', type: 'symbol', source: STATIONS_SOURCE,
        filter: ['!', ['has', 'point_count']], layout: { 'text-field': 'ϟ', 'text-size': 17, 'text-font': ['Noto Sans Regular'], 'text-allow-overlap': true }, paint: { 'text-color': colors.white } });
      map.addSource('selected-station', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'selected-ring', type: 'circle', source: 'selected-station', paint: { 'circle-radius': 18, 'circle-color': colors.accent, 'circle-opacity': 0.18, 'circle-stroke-color': colors.accentInk, 'circle-stroke-width': 3 } });

      // Click cluster -> zoom in
      map.on('click', CLUSTER_LAYER, (e: MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: [CLUSTER_LAYER],
        });
        if (!features.length) return;
        const feature = features[0];
        const clusterId = feature.properties?.cluster_id as number;
        const source = map.getSource(STATIONS_SOURCE) as GeoJSONSource;
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          const geometry = feature.geometry;
          if (geometry.type === 'Point') {
            map.easeTo({
              center: geometry.coordinates as [number, number],
              zoom, duration: 0,
            });
          }
        });
      });

      // Click station -> show detail
      map.on('click', UNCLUSTERED_LAYER, (e: MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: [UNCLUSTERED_LAYER],
        });
        if (!features.length) return;
        const props = features[0].properties;
        if (!props) return;

        // Reconstruct station from feature properties
        const station: MapStation = {
          location_id: props.location_id as string,
          name: props.name as string | null,
          operator_name: props.operator_name as string | null,
          address: props.address as string | null,
          city: props.city as string | null,
          latitude: props.latitude as number,
          longitude: props.longitude as number,
          total_evse_count: Number(props.total_evse_count),
          available_evse_count: Number(props.available_evse_count),
          charging_evse_count: Number(props.charging_evse_count),
          unavailable_evse_count: Number(props.unavailable_evse_count),
          unknown_evse_count: Number(props.unknown_evse_count),
          connector_types: props.connector_types
            ? (typeof props.connector_types === 'string'
              ? JSON.parse(props.connector_types) as string[]
              : props.connector_types as string[])
            : null,
          max_power_kw: props.max_power_kw != null ? Number(props.max_power_kw) : null,
          last_observed_at: props.last_observed_at as string | null,
        };
        setSelectedStation(station);
        setExpanded(true);
        const layout = layoutRef.current;
        map.easeTo({ center: [station.longitude, station.latitude], zoom: 15, duration: layout.reduced ? 0 : 280,
          offset: layout.wide ? [200, 0] : [0, -map.getContainer().clientHeight * 0.36 - 20] });
      });

      setMapReady(true);

      // Cursor changes
      map.on('mouseenter', CLUSTER_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', CLUSTER_LAYER, () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', UNCLUSTERED_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', UNCLUSTERED_LAYER, () => {
        map.getCanvas().style.cursor = '';
      });
    });

    map.on('moveend', () => updateBounds(map));
    map.on('error', () => {
      if (!map.loaded()) setHasLoadingError(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [updateBounds]);

  useEffect(() => {
    const controls = mapRef.current?.getContainer().querySelector<HTMLElement>('.maplibregl-ctrl-bottom-right');
    if (controls) controls.style.bottom = '0';
  }, [selectedStation, expanded, mapReady]);

  useEffect(() => {
    const source = mapRef.current?.getSource('selected-station') as GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features: highlightedStation ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [highlightedStation.longitude, highlightedStation.latitude] }, properties: {} }] : [] });
  }, [highlightedStation, mapReady]);

  // Update GeoJSON data when stations change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource(STATIONS_SOURCE) as GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    }
  }, [geojson, mapReady]);

  useEffect(() => {
    markerRef.current?.remove(); markerRef.current = null;
    if (!location.position || !mapRef.current || !mapReady) return;
    const dot = document.createElement('div');
    dot.setAttribute('aria-label', 'Your foreground location');
    Object.assign(dot.style, { width: '16px', height: '16px', borderRadius: '50%', background: colors.location, border: `3px solid ${colors.white}`, boxShadow: `0 0 0 7px ${colors.locationHalo}` });
    markerRef.current = new Marker({ element: dot }).setLngLat([location.position.lng, location.position.lat]).addTo(mapRef.current);
    return () => { markerRef.current?.remove(); markerRef.current = null; };
  }, [location.position, mapReady]);

  const highlight = useCallback((station: MapStation | null) => {
    setHighlightedStation(station);
    if (station) mapRef.current?.easeTo({ center: [station.longitude, station.latitude], zoom: 14.5,
      duration: reduced ? 0 : 240, offset: wide ? [220, 0] : [0, -mapRef.current.getContainer().clientHeight * .36] });
  }, [wide, reduced]);
  useEffect(() => {
    if (!panelRef.current) return;
    const observer = new ResizeObserver((entries) => setPanelHeight(entries[0].contentRect.height));
    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div aria-label="Interactive map of EV charging stations" style={webStyles.container}>
      <div ref={containerRef} style={webStyles.map} />

      {/* Overlay controls */}
      <div style={{ ...webStyles.overlayTop, left: 'auto', right: 80, top: 'auto', bottom: wide ? 20 : panelHeight + 12, maxWidth: wide ? 420 : 280 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Map filters" onPress={() => setFilterRequest((value) => value + 1)} style={{ minHeight: 48, alignSelf: 'flex-start', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.overlayBorder }}><Text style={{ color: colors.textPrimary, fontSize: 13 }}>Filters</Text></Pressable>
        {error ? <div style={webStyles.statusContainer}>
          <MapStatus
            loading={loading}
            error={error}
            stationCount={stations.length}
            lastFetched={lastFetched}
            onRetry={refresh}
          />
        </div> : null}
      </div>

      <div style={{ position: 'absolute', right: 16, bottom: wide ? 20 : panelHeight + 12, zIndex: 3 }}>
        <LocationControl busy={location.busy} error={location.error} onPress={() => {
          void location.locate().then((fix) => { if (fix) mapRef.current?.easeTo({ center: [fix.lng, fix.lat], zoom: 15, duration: reduced ? 0 : 280, offset: wide ? [200, 0] : [0, -panelHeight / 2] }); });
        }} />
      </div>
      <div ref={panelRef} className="driver-sheet" style={{ ...webStyles.detailPanel,
        ...(wide ? { top: 20, bottom: 'auto', left: 20, right: 'auto', width: 440, height: sheetCollapsed ? 48 : expanded ? '86%' : 300, borderRadius: 24 } : { left: 0, right: 0, bottom: 0, height: sheetCollapsed ? 48 : expanded ? '72%' : 300, maxHeight: expanded ? '85%' : '65%' }) }}>
        <ExperiencePanel onCollapseChange={setSheetCollapsed} filterRequest={filterRequest} selected={selectedStation} standard={standard} onStandardChange={setStandard}
          bounds={bounds} onFiltersChange={setFilters} onPresentationChange={setExpanded}
          onLocate={async (signal) => {
            const fix = await location.locate(); if (!fix || signal.aborted) return null;
            mapRef.current?.easeTo({ center: [fix.lng, fix.lat], zoom: 14, duration: reduced ? 0 : 240, offset: wide ? [220, 0] : [0, -panelHeight / 2] });
            return { lat: fix.lat, lng: fix.lng };
          }}
          onClose={() => setSelectedStation(null)} onHighlight={highlight}
          onWiden={() => { mapRef.current?.easeTo({ zoom: 11, duration: reduced ? 0 : 240 }); }} />
      </div>

      {hasLoadingError ? (
        <div role="alert" style={webStyles.error}>
          Map could not be loaded.
        </div>
      ) : null}
    </div>
  );
}

const webStyles = {
  container: {
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  map: {
    height: '100%',
    width: '100%',
  },
  overlayTop: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 72,
    zIndex: 1,
    pointerEvents: 'auto' as const,
  },
  statusContainer: {
    marginTop: 4,
    paddingHorizontal: 8,
  },
  detailPanel: {
    display: 'flex',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    maxWidth: 'none',
  },
  error: {
    backgroundColor: MAP_ERROR_BACKGROUND_COLOR,
    borderRadius: 8,
    color: MAP_ERROR_TEXT_COLOR,
    left: 16,
    padding: 12,
    position: 'absolute',
    right: 16,
    textAlign: 'center',
    top: 16,
    zIndex: 10,
  },
} as const;
