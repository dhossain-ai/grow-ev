import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton, CardReveal } from '../../components/CalmUI';
import { colors } from '../map/tokens';
import { transcribe } from './api';
import { parseCommand, type VoiceCommand } from './commands';
import { useRecording } from './useRecording';
import { MicrophoneIcon } from '../../components/DriverIcons';
import { microphoneFailure, type VoiceActionResult, type VoicePhase } from './states';

export function VoiceControl({ onCommand, onActiveChange, hideTrigger = false }: {
  onCommand: (command: VoiceCommand, signal: AbortSignal) => Promise<VoiceActionResult>;
  onActiveChange?: (active: boolean) => void; hideTrigger?: boolean;
}) {
  const recording = useRecording();
  const operations = useRef(recording);
  useEffect(() => { operations.current = recording; }, [recording]);
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [message, setMessage] = useState('');
  useEffect(() => { onActiveChange?.(phase !== 'idle' && phase !== 'success'); }, [phase, onActiveChange]);
  useEffect(() => { if (phase !== 'success') return; const timer = setTimeout(() => setPhase('idle'), 2400); return () => clearTimeout(timer); }, [phase]);
  const attempt = useRef(0), busy = useRef(false), alive = useRef(true);
  const permissionPending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimer = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = null; }, []);
  const invalidate = useCallback(() => { attempt.current += 1; }, []);
  const cancel = useCallback(async () => {
    invalidate(); busy.current = true; stopTimer(); controller.current?.abort();
    setPhase('canceling'); setMessage('Command canceled. If a permission prompt is open, dismiss it to retry.');
    // Serialize cancellation with permission/stop/decode to prevent an old attempt stopping a retry.
    await pending.current?.catch(() => {});
    try { await operations.current.cancel(); }
    catch { /* Cancellation still invalidates every late response. */ }
    if (alive.current) { busy.current = false; setPhase('idle'); setMessage('Recording canceled. Tap Speak to try again.'); }
  }, [invalidate, stopTimer]);
  useEffect(() => {
    if (Platform.OS !== 'android' || phase === 'idle' || phase === 'success') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { void cancel(); return true; });
    return () => subscription.remove();
  }, [phase, cancel]);
  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      // Android's permission dialog can temporarily background the activity.
      if (state === 'background' && !permissionPending.current) void cancel();
    });
    return () => { alive.current = false; invalidate(); stopTimer(); controller.current?.abort(); void operations.current.cancel().catch(() => {}); subscription.remove(); };
  }, [cancel, invalidate, stopTimer]);
  const finish = async () => {
    if (busy.current) return;
    busy.current = true; stopTimer(); const id = attempt.current;
    setPhase('processing'); setMessage('Recognizing your command…');
    const current = new AbortController(); controller.current = current;
    const timeout = setTimeout(() => current.abort(), 30000);
    try {
      const audio = await operations.current.finish();
      if (id !== attempt.current || !alive.current) return;
      const transcript = await transcribe(audio, current.signal);
      if (id !== attempt.current || !alive.current) return;
      const command = parseCommand(transcript);
      if (!command) { setPhase('unrecognized'); setMessage('Try asking for a charger type or nearby charging stations.'); return; }
      const result = await onCommand(command, current.signal);
      if (id === attempt.current && alive.current) { setMessage(result.message); setPhase(result.ok ? 'success' : 'error'); }
    } catch (error) {
      if (id === attempt.current && alive.current) { setPhase('error'); setMessage(error instanceof Error ? error.message : 'Voice unavailable. Please retry.'); }
    } finally { clearTimeout(timeout); if (id === attempt.current) busy.current = false; }
  };
  const start = async () => {
    if (busy.current) return;
    busy.current = true; permissionPending.current = true;
    const id = ++attempt.current; setPhase('requesting_permission'); setMessage('Waiting for microphone permission.');
    try {
      await operations.current.start();
      if (id !== attempt.current || !alive.current || AppState.currentState === 'background') {
        await operations.current.cancel();
        if (id === attempt.current && alive.current) { busy.current = false; setPhase('idle'); setMessage('Recording canceled while the app was in the background.'); }
        return;
      }
      busy.current = false; setPhase('listening'); setMessage('Tell Grow EV what you’re looking for.');
      timer.current = setTimeout(() => { pending.current = finish(); }, 9000);
    } catch (error) {
      if (id === attempt.current && alive.current) { busy.current = false; setPhase(microphoneFailure(error)); setMessage(error instanceof Error ? error.message : 'Microphone unavailable. Please retry.'); }
    } finally { permissionPending.current = false; }
  };
  if (phase === 'idle') return hideTrigger ? null : <Pressable accessibilityRole="button" accessibilityLabel="Speak charging command" style={styles.trigger} onPress={() => { pending.current = start(); }}><MicrophoneIcon /></Pressable>;
  if (phase === 'success') return <View accessibilityLiveRegion="polite" style={styles.toast}><Text style={styles.success}>✓</Text><Text style={styles.message}>{message}</Text></View>;
  const waiting = ['processing', 'requesting_permission', 'canceling'].includes(phase);
  const title = phase === 'listening' ? 'Listening…' : phase === 'processing' ? 'Understanding\nyour request…' : phase === 'requesting_permission' ? 'Allow microphone access' : phase === 'permission_denied' ? 'Microphone access\nis off' : phase === 'unrecognized' ? 'Didn’t catch that' : phase === 'canceling' ? 'Canceling…' : 'Voice search unavailable';
  return <CardReveal key={phase} style={styles.box}>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    <Text accessibilityLiveRegion="polite" accessibilityRole={['error', 'permission_denied'].includes(phase) ? 'alert' : undefined} style={styles.message}>{phase === 'processing' ? 'Finding the right charging options.' : phase === 'permission_denied' ? `Allow microphone access in your ${Platform.OS === 'web' ? 'browser' : 'app'} settings to search by voice.` : message}</Text>
    <View style={styles.indicator}>{waiting ? <ActivityIndicator size="large" color={colors.accentInk} /> : <MicrophoneIcon size={36} />}</View>
    {phase === 'listening' ? <><Text style={styles.example}>Try “Find CCS2 chargers” or “Show chargers near me”</Text><ActionButton label="Finish speaking  ■" onPress={() => { pending.current = finish(); }} /></> : null}
    {!waiting && phase !== 'listening' ? <><ActionButton label={phase === 'permission_denied' ? 'Continue without voice' : 'Try again'} onPress={() => { if (phase === 'permission_denied') void cancel(); else pending.current = start(); }} />
      {phase === 'permission_denied' && Platform.OS !== 'web' ? <ActionButton secondary label="Open microphone settings" onPress={() => { void Linking.openSettings().catch(() => setMessage('Open Grow EV permissions in Android settings.')); }} /> : <ActionButton secondary label={phase === 'permission_denied' ? 'Try again' : 'Search manually'} onPress={() => { if (phase === 'permission_denied') pending.current = start(); else void cancel(); }} />}</> : null}
    {waiting || phase === 'listening' ? <ActionButton secondary disabled={phase === 'canceling'} label="Cancel voice" onPress={() => { void cancel(); }} /> : null}
    <Text style={styles.privacy}>Up to 10 seconds · Audio sent to Cloudflare for transcription.</Text>
  </CardReveal>;
}
const styles = StyleSheet.create({
  box: { position: 'absolute', top: 28, bottom: 0, left: 0, right: 0, backgroundColor: colors.main, padding: 20, gap: 12, justifyContent: 'center', zIndex: 6 },
  trigger: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 30, borderWidth: 1, borderColor: colors.overlayBorder, backgroundColor: colors.main, justifyContent: 'center', alignItems: 'center', zIndex: 4 },
  title: { color: colors.textPrimary, fontSize: 28, lineHeight: 32, fontWeight: '700', letterSpacing: -.8 },
  message: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, flexShrink: 1 },
  indicator: { width: 90, height: 90, borderRadius: 50, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.accentSoft, borderWidth: 2, borderColor: colors.accent, marginVertical: 8 },
  example: { fontSize: 13, lineHeight: 18, color: colors.textSecondary, textAlign: 'center' },
  privacy: { fontSize: 11, lineHeight: 16, color: colors.textMuted, textAlign: 'center' },
  toast: { position: 'absolute', top: 30, left: 20, right: 20, backgroundColor: colors.main, borderRadius: 18, borderWidth: 1, borderColor: colors.accent, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center', zIndex: 8 },
  success: { color: colors.accentInk, fontSize: 22 },
});
