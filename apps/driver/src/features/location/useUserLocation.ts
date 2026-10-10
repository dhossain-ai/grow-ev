import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { POSITION_MAX_AGE_MS, type UserPosition } from './position';
import { requestPosition } from './requestPosition';

/** One explicit foreground fix; no watcher, persistence or automatic permission requests. */
export function useUserLocation() {
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  const pending = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    active.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      // Android's permission dialog temporarily backgrounds the activity too.
      if (state !== 'active') { if (!pending.current) generation.current++; setPosition(null); }
    });
    return () => { active.current = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!position) return;
    const timer = setTimeout(() => setPosition(null), Math.max(0, position.timestamp + POSITION_MAX_AGE_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [position]);
  const locate = async () => {
    if (pending.current) return null;
    pending.current = true;
    setBusy(true); setError(null); setPosition(null);
    const attempt = generation.current;
    try {
      const fix = await requestPosition();
      if (!active.current || generation.current !== attempt || AppState.currentState === 'background') return null;
      setPosition(fix);
      return fix;
    } catch (failure) {
      if (active.current && generation.current === attempt) setError(failure instanceof Error ? failure.message : 'Location unavailable. Please retry.');
      return null;
    } finally { pending.current = false; if (active.current) setBusy(false); }
  };
  return { position, busy, error, locate };
}
