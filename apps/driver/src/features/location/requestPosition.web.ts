import { locationError, positionFromFix, type UserPosition } from './position';

export async function requestPosition(): Promise<UserPosition> {
  if (!window.isSecureContext) throw new Error('Location requires HTTPS or localhost.');
  if (!navigator.geolocation) throw new Error('This browser does not support location.');
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    (fix) => { try { resolve(positionFromFix(fix.coords, fix.timestamp)); } catch (error) { reject(error); } },
    (error) => reject(new Error(locationError(error.code))),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  ));
}
