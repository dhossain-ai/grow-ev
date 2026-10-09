/**
 * Hook for fetching and managing map station data.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchMapStations, StationsApiError } from './api';
import type {
  BoundingBox,
  MapStation,
  StationFeatureCollection,
  StationFilters,
} from './types';
import { toGeoJSON } from './types';

export interface UseMapStationsState {
  /** GeoJSON data ready for MapLibre source. */
  geojson: StationFeatureCollection;
  /** Raw station data. */
  stations: MapStation[];
  /** True during initial load. */
  loading: boolean;
  /** Error message if the last fetch failed. */
  error: string | null;
  /** ISO timestamp of last successful fetch. */
  lastFetched: string | null;
  /** Manually trigger a refresh. */
  refresh: () => void;
}

const EMPTY_GEOJSON: StationFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

/** Debounce delay for bounds changes in ms. */
const DEBOUNCE_MS = 300;

/**
 * Default bounding box covering Lithuania.
 * Used for the initial load before the user pans.
 */
const LITHUANIA_BOUNDS: BoundingBox = [20.9, 53.9, 26.9, 56.5];

export function useMapStations(
  bounds?: BoundingBox | null,
  filters?: StationFilters,
): UseMapStationsState {
  const [stations, setStations] = useState<MapStation[]>([]);
  const [geojson, setGeojson] = useState<StationFeatureCollection>(EMPTY_GEOJSON);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const west = bounds?.[0] ?? LITHUANIA_BOUNDS[0];
  const south = bounds?.[1] ?? LITHUANIA_BOUNDS[1];
  const east = bounds?.[2] ?? LITHUANIA_BOUNDS[2];
  const north = bounds?.[3] ?? LITHUANIA_BOUNDS[3];
  const minPowerKw = filters?.minPowerKw;
  const connectorKey = filters?.connectorStandards?.join(',');

  useEffect(() => {
    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const abortController = new AbortController();
      // Abort previous in-flight request
      abortRef.current?.abort();
      abortRef.current = abortController;

      const effectiveBounds: BoundingBox = [west, south, east, north];
      const effectiveFilters: StationFilters = {
        minPowerKw,
        connectorStandards: connectorKey ? connectorKey.split(',') : undefined,
      };

      setLoading(true);

      fetchMapStations(effectiveBounds, effectiveFilters, abortController.signal)
        .then((data) => {
          if (abortController.signal.aborted) return;
          setStations(data);
          setGeojson(toGeoJSON(data));
          setError(null);
          setLastFetched(new Date().toISOString());
        })
        .catch((err: unknown) => {
          if (abortController.signal.aborted) return;
          if (err instanceof StationsApiError) {
            setError(err.message);
          } else if (err instanceof Error && err.name !== 'AbortError') {
            setError(`Network error: ${err.message}`);
          }
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      abortRef.current?.abort();
    };
  }, [west, south, east, north, minPowerKw, connectorKey, refreshKey]);

  return { geojson, stations, loading, error, lastFetched, refresh };
}
