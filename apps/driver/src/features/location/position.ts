export interface UserPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}
export const POSITION_MAX_AGE_MS = 2 * 60 * 1000;

export function positionFromFix(coords: { latitude: number; longitude: number; accuracy: number | null }, timestamp: number, now = Date.now()): UserPosition {
  if (!Number.isFinite(coords.latitude) || Math.abs(coords.latitude) > 90 ||
      !Number.isFinite(coords.longitude) || Math.abs(coords.longitude) > 180 ||
      coords.accuracy === null || !Number.isFinite(coords.accuracy) || coords.accuracy < 0 ||
      !Number.isFinite(timestamp) || timestamp > now || now - timestamp > POSITION_MAX_AGE_MS) {
    throw new Error('Location is unavailable or outdated. Please try again.');
  }
  return { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy, timestamp };
}

export function locationError(code: number): string {
  return code === 1 ? 'Location permission denied. Enable it in app or browser settings to try again.' :
    code === 3 ? 'Location timed out. Move to an open area and try again.' :
    'Location is unavailable. Check that location services are enabled and try again.';
}
