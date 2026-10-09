import { Camera, Map } from '@maplibre/maplibre-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MAP_ERROR_BACKGROUND_COLOR,
  MAP_ERROR_TEXT_COLOR,
  OPENFREEMAP_STYLE_URL,
  VILNIUS_CENTER,
  VILNIUS_INITIAL_ZOOM,
} from './mapConfig';

export function GrowMap() {
  const [hasLoadingError, setHasLoadingError] = useState(false);

  return (
    <View style={styles.container}>
      <Map
        attribution
        attributionPosition={{ bottom: 8, left: 8 }}
        dragPan
        mapStyle={OPENFREEMAP_STYLE_URL}
        onDidFailLoadingMap={() => setHasLoadingError(true)}
        onDidFinishLoadingMap={() => setHasLoadingError(false)}
        style={styles.map}
        touchZoom
      >
        <Camera
          initialViewState={{
            center: VILNIUS_CENTER,
            zoom: VILNIUS_INITIAL_ZOOM,
          }}
        />
      </Map>

      {hasLoadingError ? (
        <View accessibilityRole="alert" style={styles.error}>
          <Text style={styles.errorText}>Map could not be loaded.</Text>
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
  error: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: MAP_ERROR_BACKGROUND_COLOR,
  },
  errorText: {
    color: MAP_ERROR_TEXT_COLOR,
    textAlign: 'center',
  },
});
