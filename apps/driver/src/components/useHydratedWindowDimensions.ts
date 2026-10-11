import { useSyncExternalStore } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => Platform.OS !== 'web';

/** Match Expo's server dimensions during hydration, then apply the actual viewport. */
export function useHydratedWindowDimensions() {
  const dimensions = useWindowDimensions();
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return hydrated ? dimensions : { width: 0, height: 0, scale: 1, fontScale: 1 };
}
