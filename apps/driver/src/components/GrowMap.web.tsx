import { Map, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import 'maplibre-gl/dist/maplibre-gl.css';

import {
  MAP_ERROR_BACKGROUND_COLOR,
  MAP_ERROR_TEXT_COLOR,
  OPENFREEMAP_STYLE_URL,
  VILNIUS_CENTER,
  VILNIUS_INITIAL_ZOOM,
} from './mapConfig';

setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

export function GrowMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasLoadingError, setHasLoadingError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const map = new Map({
      attributionControl: {},
      center: VILNIUS_CENTER,
      container: containerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      zoom: VILNIUS_INITIAL_ZOOM,
    });

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => setHasLoadingError(false));
    map.on('error', () => {
      if (!map.loaded()) {
        setHasLoadingError(true);
      }
    });

    return () => map.remove();
  }, []);

  return (
    <div aria-label="Interactive map of Vilnius" style={styles.container}>
      <div ref={containerRef} style={styles.map} />
      {hasLoadingError ? (
        <div role="alert" style={styles.error}>
          Map could not be loaded.
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  container: {
    height: '100%',
    position: 'relative',
    width: '100%',
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
  },
  map: {
    height: '100%',
    width: '100%',
  },
} as const;
