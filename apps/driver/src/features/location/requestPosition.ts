import * as Location from 'expo-location';
import { locationError, positionFromFix, type UserPosition } from './position';

export async function requestPosition(): Promise<UserPosition> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error(locationError(1));
  if (!await Location.hasServicesEnabledAsync()) throw new Error(locationError(2));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: false }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(locationError(3))), 15000); }),
    ]);
    return positionFromFix(fix.coords, fix.timestamp);
  } catch (error) {
    if (error instanceof Error && error.message === locationError(3)) throw error;
    throw new Error(locationError(2));
  } finally { clearTimeout(timer); }
}
