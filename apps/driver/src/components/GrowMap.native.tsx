import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
} from '@maplibre/maplibre-react-native';
import type {
  CameraRef,
  GeoJSONSourceRef,
  PressEventWithFeatures,
  ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import { useCallback, useRef, useState } from 'react';
import { NativeSyntheticEvent, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import capturedCase from '../features/experience/recordedCase.json';
import { ExperiencePanel } from '../features/experience/ExperiencePanel';
import { useReducedMotion } from './CalmUI';
import type { ConnectorStandard } from '../features/map/congestion';
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
  useMapStations,
  availabilityColors,
  colors,
} from '../features/map';
import type { BoundingBox, MapStation, StationFilters } from '../features/map';

const STATIONS_SOURCE = 'stations';
const CLUSTER_LAYER = 'station-clusters';
const CLUSTER_COUNT_LAYER = 'cluster-count';
const UNCLUSTERED_LAYER = 'unclustered-station';

export function GrowMap() {
  const sourceRef = useRef<GeoJSONSourceRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const [hasLoadingError, setHasLoadingError] = useState(false);
  const [bounds, setBounds] = useState<BoundingBox | null>(null);
  const [selectedStation, setSelectedStation] = useState<MapStation | null>(null);
  const location = useUserLocation();
  const [expanded, setExpanded] = useState(false);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const reduced = useReducedMotion();
  const [standard, setStandard] = useState<ConnectorStandard>('IEC_62196_T2_COMBO');
  const [showCase, setShowCase] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(0);
  const [mapHeight, setMapHeight] = useState(0);
  const [filters, setFilters] = useState<StationFilters>({});
  const { geojson, stations, loading, error, lastFetched, refresh } =
    useMapStations(bounds, filters);

  const onRegionDidChange = useCallback((event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    const b = event.nativeEvent.bounds;
    if (b) {
      setBounds(b);
    }
  }, []);

  const onSourcePress = useCallback(
    (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
      const feature = event.nativeEvent.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return;

      const isCluster = feature.properties?.cluster;
      if (isCluster) {
        const coords = feature.geometry.coordinates as [number, number];
        const clusterId = feature.properties?.cluster_id as number;
        sourceRef.current?.getClusterExpansionZoom(clusterId).then((zoom) => {
          cameraRef.current?.easeTo({ center: coords, zoom, duration: reduced ? 0 : 280 });
        }).catch(() => setHasLoadingError(true));
        return;
      }

      // Not a cluster, it's a station
      const props = feature.properties;
      if (!props) return;

      const station: MapStation = {
        location_id: props.location_id as string,
        name: props.name as string | null,
        operator_name: props.operator_name as string | null,
        address: props.address as string | null,
        city: props.city as string | null,
        latitude: Number(props.latitude),
        longitude: Number(props.longitude),
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
      setShowCase(false);
      cameraRef.current?.easeTo({ center: [station.longitude, station.latitude], zoom: 15, duration: reduced ? 0 : 280, padding: wide ? { left: 424 } : { bottom: mapHeight * 0.72 + 80 } });
    },
    [reduced, wide, mapHeight],
  );

  return (
    <View style={styles.container} onLayout={(event) => setMapHeight(event.nativeEvent.layout.height)}>
      <Map
        attribution
        attributionPosition={{ bottom: 8, left: 8 }}
        dragPan
        mapStyle={OPENFREEMAP_STYLE_URL}
        onDidFailLoadingMap={() => setHasLoadingError(true)}
        onDidFinishLoadingMap={() => setHasLoadingError(false)}
        onRegionDidChange={onRegionDidChange}
        style={styles.map}
        touchZoom
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: VILNIUS_CENTER,
            zoom: VILNIUS_INITIAL_ZOOM,
          }}
        />

        {location.position ? <GeoJSONSource id="user-location" data={{ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [location.position.lng, location.position.lat] }, properties: {} }] }}>
          <Layer id="user-location-halo" type="circle" paint={{ 'circle-radius': 16, 'circle-color': colors.location, 'circle-opacity': 0.18 }} />
          <Layer id="user-location-dot" type="circle" paint={{ 'circle-radius': 11, 'circle-color': colors.location, 'circle-stroke-width': 3, 'circle-stroke-color': colors.white }} />
        </GeoJSONSource> : null}
        <GeoJSONSource
          ref={sourceRef}
          id={STATIONS_SOURCE}
          data={geojson}
          cluster
          clusterMaxZoom={14}
          clusterRadius={50}
          onPress={onSourcePress}
        >
          {/* Cluster circles */}
          <Layer
            id={CLUSTER_LAYER}
            type="circle"
            filter={['has', 'point_count']}
            paint={{
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
            }}
          />

          {/* Cluster count labels */}
          <Layer
            id={CLUSTER_COUNT_LAYER}
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': ['get', 'point_count_abbreviated'],
              'text-size': 13,
              'text-font': ['Noto Sans Regular'],
              'text-allow-overlap': true,
            }}
            paint={{
              'text-color': colors.textPrimary,
            }}
          />

          {/* Individual station markers */}
          <Layer
            id={UNCLUSTERED_LAYER}
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
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
            }}
          />
          <Layer id="charging-symbol" type="symbol" filter={['!', ['has', 'point_count']]}
            layout={{ 'text-field': 'ϟ', 'text-size': 17, 'text-font': ['Noto Sans Regular'], 'text-allow-overlap': true }} paint={{ 'text-color': colors.white }} />
        </GeoJSONSource>
        {selectedStation ? <GeoJSONSource id="selected-station" data={{ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [selectedStation.longitude, selectedStation.latitude] }, properties: {} }] }}>
          <Layer id="selected-ring" type="circle" paint={{ 'circle-radius': 18, 'circle-color': colors.accent, 'circle-opacity': 0.18, 'circle-stroke-color': colors.accentInk, 'circle-stroke-width': 3 }} />
        </GeoJSONSource> : null}
      </Map>

      {/* Overlay controls */}
      <View style={[styles.overlayTop, { left: wide ? 448 : 16, maxWidth: 420 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Map filters" accessibilityState={{ expanded: filtersOpen }} onPress={() => setFiltersOpen((value) => !value)} style={{ minHeight: 48, alignSelf: 'flex-start', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.overlayBorder }}><Text style={{ color: colors.textPrimary, fontSize: 13 }}>Filters {filtersOpen ? '−' : '+'}</Text></Pressable>
        {filtersOpen ? <FilterBar filters={filters} onFiltersChange={setFilters} /> : null}
      {filtersOpen ? <View style={{ padding: 8, backgroundColor: colors.overlayBackground, borderRadius: 12 }}>
        <Text style={styles.legendText}>● Available · In use · Unavailable · Unverified</Text>
      </View> : null}
        <View style={styles.statusContainer}>
          <MapStatus
            loading={loading}
            error={error}
            stationCount={stations.length}
            lastFetched={lastFetched}
            onRetry={refresh}
          />
        </View>
      </View>

      <View style={{ position: 'absolute', right: 16, bottom: wide ? 64 : panelHeight + 56, zIndex: 3 }}>
        <LocationControl busy={location.busy} error={location.error} onPress={() => {
          void location.locate().then((fix) => { if (fix) cameraRef.current?.easeTo({ center: [fix.lng, fix.lat], zoom: 15, duration: reduced ? 0 : 280, padding: wide ? { left: 424 } : { bottom: panelHeight } }); });
        }} />
      </View>
      <View onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)} style={[styles.detailPanel,
        wide ? { top: 24, bottom: 48, left: 24, right: undefined, width: 400, height: undefined, maxHeight: !selectedStation && !showCase ? 500 : undefined } : { left: 12, right: 12, bottom: 40, height: showCase || (selectedStation && expanded) ? '72%' : selectedStation ? 200 : '64%', maxHeight: !selectedStation && !showCase ? 440 : undefined }]}>
        <ExperiencePanel selected={selectedStation} standard={standard} onStandardChange={setStandard}
          expanded={expanded} onToggle={() => setExpanded((value) => !value)} onClose={() => setSelectedStation(null)}
          onSelect={(station) => { setSelectedStation(station); setExpanded(true); setShowCase(false); cameraRef.current?.easeTo({ center: [station.longitude, station.latitude], zoom: 15, duration: reduced ? 0 : 280, padding: wide ? { left: 424 } : { bottom: mapHeight * 0.72 + 80 } }); }}
          stations={stations} loading={loading} error={error} userOrigin={location.position ? { lat: location.position.lat, lng: location.position.lng } : undefined}
          showCase={showCase} onCase={() => { setShowCase(true); cameraRef.current?.easeTo({ center: [capturedCase.selected.station.longitude, capturedCase.selected.station.latitude], zoom: 14.5, duration: reduced ? 0 : 280, padding: wide ? { left: 424 } : { bottom: mapHeight * 0.72 + 80 } }); }} onCloseCase={() => setShowCase(false)} />
      </View>

      {hasLoadingError ? (
        <View accessibilityRole="alert" style={styles.error}>
          <Text style={{ color: MAP_ERROR_TEXT_COLOR }}>Map could not be loaded.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  legendText: { color: colors.textSecondary, fontSize: 11 },
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  overlayTop: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 8,
    zIndex: 1,
  },
  statusContainer: {
    marginTop: 4,
    paddingHorizontal: 8,
  },
  detailPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  error: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: MAP_ERROR_BACKGROUND_COLOR,
    zIndex: 10,
  },
});
