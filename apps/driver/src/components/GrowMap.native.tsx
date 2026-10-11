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
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, NativeSyntheticEvent, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

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
  const [highlightedStation, setHighlightedStation] = useState<MapStation | null>(null);
  const [filterRequest, setFilterRequest] = useState(0);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [mapHeight, setMapHeight] = useState(0);
  const [sheetHeight] = useState(() => new Animated.Value(300));
  const targetHeight = sheetCollapsed ? 48 : wide ? (expanded ? mapHeight * .86 : 300) : expanded ? mapHeight * .72 : Math.min(300, mapHeight * .65);
  const panelHeight = targetHeight;
  useEffect(() => {
    if (!mapHeight) return;
    const animation = Animated.timing(sheetHeight, { toValue: targetHeight, duration: reduced ? 0 : 240, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [sheetHeight, targetHeight, reduced, mapHeight]);
  const [filters, setFilters] = useState<StationFilters>({ connectorStandards: ['IEC_62196_T2_COMBO'] });
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
      cameraRef.current?.easeTo({ center: [station.longitude, station.latitude], zoom: 15, duration: reduced ? 0 : 280, padding: wide ? { left: 424 } : { bottom: mapHeight * 0.72 + 80 } });
    },
    [reduced, wide, mapHeight],
  );

  const highlight = useCallback((station: MapStation | null) => {
    setHighlightedStation(station);
    if (station) cameraRef.current?.easeTo({ center: [station.longitude, station.latitude], zoom: 14.5,
      duration: reduced ? 0 : 240, padding: wide ? { left: 460 } : { bottom: mapHeight * .72 } });
  }, [wide, reduced, mapHeight]);

  return (
    <View style={styles.container} onLayout={(event) => setMapHeight(event.nativeEvent.layout.height)}>
      <Map
        attribution
        attributionPosition={{ bottom: 8, left: 8 }}
        dragPan
        mapStyle={PREMIUM_MAP_STYLE}
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
        {highlightedStation ? <GeoJSONSource id="selected-station" data={{ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [highlightedStation.longitude, highlightedStation.latitude] }, properties: {} }] }}>
          <Layer id="selected-ring" type="circle" paint={{ 'circle-radius': 18, 'circle-color': colors.accent, 'circle-opacity': 0.18, 'circle-stroke-color': colors.accentInk, 'circle-stroke-width': 3 }} />
        </GeoJSONSource> : null}
      </Map>

      {/* Overlay controls */}
      <View style={[styles.overlayTop, { left: undefined, right: 80, top: undefined, bottom: wide ? 20 : panelHeight + 12, maxWidth: 280 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Map filters" onPress={() => setFilterRequest((value) => value + 1)} style={{ minHeight: 48, alignSelf: 'flex-start', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.overlayBorder }}><Text style={{ color: colors.textPrimary, fontSize: 13 }}>Filters</Text></Pressable>
        {error ? <View style={styles.statusContainer}>
          <MapStatus
            loading={loading}
            error={error}
            stationCount={stations.length}
            lastFetched={lastFetched}
            onRetry={refresh}
          />
        </View> : null}
      </View>

      <View style={{ position: 'absolute', right: 16, bottom: wide ? 20 : panelHeight + 12, zIndex: 3 }}>
        <LocationControl busy={location.busy} error={location.error} onPress={() => {
          void location.locate().then((fix) => { if (fix) cameraRef.current?.easeTo({ center: [fix.lng, fix.lat], zoom: 15, duration: reduced ? 0 : 280, padding: wide ? { left: 424 } : { bottom: panelHeight } }); });
        }} />
      </View>
      <Animated.View style={[styles.detailPanel,
        wide ? { top: 20, left: 20, right: undefined, width: 440, height: sheetHeight } : { left: 0, right: 0, bottom: 0, height: sheetHeight }]}>
        <ExperiencePanel onCollapseChange={setSheetCollapsed} filterRequest={filterRequest} selected={selectedStation} standard={standard} onStandardChange={setStandard}
          bounds={bounds} onFiltersChange={setFilters} onPresentationChange={setExpanded}
          onLocate={async (signal) => {
            const fix = await location.locate(); if (!fix || signal.aborted) return null;
            cameraRef.current?.easeTo({ center: [fix.lng, fix.lat], zoom: 14, duration: reduced ? 0 : 240, padding: wide ? { left: 460 } : { bottom: panelHeight } });
            return { lat: fix.lat, lng: fix.lng };
          }}
          onClose={() => setSelectedStation(null)} onHighlight={highlight}
          onWiden={() => { cameraRef.current?.easeTo({ center: bounds ? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] : VILNIUS_CENTER, zoom: 11, duration: reduced ? 0 : 240 }); }} />
      </Animated.View>

      {hasLoadingError ? (
        <View accessibilityRole="alert" style={styles.error}>
          <Text style={{ color: MAP_ERROR_TEXT_COLOR }}>Map could not be loaded.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
