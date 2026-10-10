import { Map, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';

import 'maplibre-gl/dist/maplibre-gl.css';

import { useUserLocation } from '../features/location/useUserLocation';
import { LocationControl } from '../features/location/LocationControl';
import {
  MAP_ERROR_BACKGROUND_COLOR,
  MAP_ERROR_TEXT_COLOR,
  OPENFREEMAP_STYLE_URL,
  VILNIUS_CENTER,
  VILNIUS_INITIAL_ZOOM,
} from './mapConfig';
import {
  FilterBar,
  MapStatus,
  StationDetail,
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
const UNCLUSTERED_GLOW_LAYER = 'unclustered-station-glow';

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
  const [filters, setFilters] = useState<StationFilters>({});
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
      style: OPENFREEMAP_STYLE_URL,
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
          'circle-stroke-color': 'rgba(0, 0, 0, 0.3)',
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

      // Individual station glow
      map.addLayer({
        id: UNCLUSTERED_GLOW_LAYER,
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
          'circle-radius': 12,
          'circle-opacity': 0.2,
          'circle-blur': 0.5,
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
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(0, 0, 0, 0.4)',
        },
      });

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
              zoom,
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
    if (controls) controls.style.bottom = selectedStation ? (expanded ? '62%' : '188px') : '0';
  }, [selectedStation, expanded, mapReady]);

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
    Object.assign(dot.style, { width: '16px', height: '16px', borderRadius: '50%', background: colors.location, border: '3px solid white', boxShadow: '0 0 0 7px rgba(38,132,255,0.18)' });
    markerRef.current = new Marker({ element: dot }).setLngLat([location.position.lng, location.position.lat]).addTo(mapRef.current);
    return () => { markerRef.current?.remove(); markerRef.current = null; };
  }, [location.position, mapReady]);

  return (
    <div aria-label="Interactive map of EV charging stations" style={webStyles.container}>
      <div ref={containerRef} style={webStyles.map} />

      {/* Overlay controls */}
      <div style={webStyles.overlayTop}>
        <FilterBar filters={filters} onFiltersChange={setFilters} />
        <div style={webStyles.statusContainer}>
          <MapStatus
            loading={loading}
            error={error}
            stationCount={stations.length}
            lastFetched={lastFetched}
            onRetry={refresh}
          />
        </div>
      </div>

      <div style={{ position: 'absolute', right: 16, bottom: selectedStation ? (expanded ? 'calc(62% + 44px)' : 232) : 84, zIndex: 3 }}>
        <LocationControl busy={location.busy} error={location.error} onPress={() => {
          void location.locate().then((fix) => { if (fix) mapRef.current?.easeTo({ center: [fix.lng, fix.lat], zoom: 15, offset: [0, selectedStation ? -(expanded ? mapRef.current.getContainer().clientHeight * 0.31 : 94) : 0] }); });
        }} />
      </div>
      {/* Legend */}
      <div style={webStyles.legend}>
        <LegendItem color={availabilityColors.available} label="Available" />
        <LegendItem color={availabilityColors.occupied} label="In Use" />
        <LegendItem color={availabilityColors.unavailable} label="Unavailable" />
        <LegendItem color={availabilityColors.unknown} label="Unverified" />
      </div>

      {/* Station detail panel */}
      {selectedStation ? (
        <div style={{ ...webStyles.detailPanel, height: expanded ? '62%' : 188 }}>
          <StationDetail
            station={selectedStation}
            userOrigin={location.position ? { lat: location.position.lat, lng: location.position.lng } : undefined}
            expanded={expanded}
            onToggleExpanded={() => setExpanded((value) => !value)}
            onSelect={(station) => {
              setSelectedStation(station);
              mapRef.current?.easeTo({ center: [station.longitude, station.latitude], zoom: 15 });
            }}
            onClose={() => setSelectedStation(null)}
          />
        </div>
      ) : null}

      {hasLoadingError ? (
        <div role="alert" style={webStyles.error}>
          Map could not be loaded.
        </div>
      ) : null}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={webStyles.legendItem}>
      <div style={{ ...webStyles.legendDot, backgroundColor: color }} />
      <span style={webStyles.legendText}>{label}</span>
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
    top: 8,
    left: 8,
    right: 60,
    zIndex: 1,
    pointerEvents: 'auto' as const,
  },
  statusContainer: {
    marginTop: 4,
    paddingHorizontal: 8,
  },
  legend: {
    position: 'absolute',
    bottom: 32,
    left: 8,
    display: 'flex',
    flexDirection: 'row' as const,
    gap: 8,
    backgroundColor: 'rgba(16, 19, 21, 0.88)',
    borderRadius: 8,
    padding: '6px 12px',
    zIndex: 1,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#A6B0B4',
    fontSize: 11,
  },
  detailPanel: {
    height: '50%',
    display: 'flex',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    maxWidth: 420,
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
