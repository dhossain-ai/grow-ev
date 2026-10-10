import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../../components/CalmUI';
import { colors } from '../map/tokens';
import { transcribe } from './api';
import { COMMAND_HELP, parseCommand, type VoiceCommand } from './commands';
import { useRecording } from './useRecording';

type Phase = 'idle' | 'permission' | 'recording' | 'processing' | 'canceling' | 'error';
export function VoiceControl({ onCommand }: { onCommand: (command: VoiceCommand, signal: AbortSignal) => Promise<string> }) {
  const recording = useRecording();
  const operations = useRef(recording);
  useEffect(() => { operations.current = recording; }, [recording]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [text, setText] = useState('');
  const [message, setMessage] = useState('Speak a charging command. Audio is sent to Cloudflare for transcription.');
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
      setText(transcript);
      const command = parseCommand(transcript);
      const result = command ? await onCommand(command, current.signal) : COMMAND_HELP;
      if (id === attempt.current && alive.current) { setMessage(result); setPhase('idle'); }
    } catch (error) {
      if (id === attempt.current && alive.current) { setPhase('error'); setMessage(error instanceof Error ? error.message : 'Voice unavailable. Please retry.'); }
    } finally { clearTimeout(timeout); if (id === attempt.current) busy.current = false; }
  };
  const start = async () => {
    if (busy.current) return;
    busy.current = true; permissionPending.current = true;
    const id = ++attempt.current; setText(''); setPhase('permission');
    try {
      await operations.current.start();
      if (id !== attempt.current || !alive.current || AppState.currentState === 'background') {
        await operations.current.cancel();
        if (id === attempt.current && alive.current) { busy.current = false; setPhase('idle'); setMessage('Recording canceled while the app was in the background.'); }
        return;
      }
      busy.current = false; setPhase('recording'); setMessage('Listening… Stop when finished (up to 10 seconds).');
      timer.current = setTimeout(() => { pending.current = finish(); }, 9000);
    } catch (error) {
      if (id === attempt.current && alive.current) { busy.current = false; setPhase('error'); setMessage(error instanceof Error ? error.message : 'Microphone unavailable. Please retry.'); }
    } finally { permissionPending.current = false; }
  };
  return <View style={styles.box}>
    <View style={styles.heading}><View accessible={false} style={styles.mic}><View style={styles.capsule} /><View style={styles.arc} /><View style={styles.stem} /></View><Text style={styles.transcript}>Voice assistant</Text></View>
    <ActionButton secondary label={phase === 'recording' ? 'Stop & use command' : phase === 'processing' ? 'Processing voice…' : phase === 'permission' ? 'Requesting microphone…' : phase === 'canceling' ? 'Canceling voice…' : phase === 'error' ? 'Retry voice command' : 'Speak charging command'}
      disabled={['processing', 'permission', 'canceling'].includes(phase)} onPress={() => { pending.current = phase === 'recording' ? finish() : start(); }} />
    {['recording', 'processing', 'permission'].includes(phase) ? <ActionButton secondary label="Cancel voice" onPress={() => { void cancel(); }} /> : null}
    {text ? <Text style={styles.transcript}>Heard: “{text}”</Text> : null}
    <Text accessibilityLiveRegion="polite" accessibilityRole={phase === 'error' ? 'alert' : undefined} style={styles.message}>{message}</Text>
  </View>;
}
const styles = StyleSheet.create({
  box: { padding: 12, gap: 8, borderBottomWidth: 1, borderColor: colors.overlayBorder },
  transcript: { color: colors.textPrimary, fontSize: 13, lineHeight: 18 },
  message: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  heading: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  mic: { width: 20, height: 24, alignItems: 'center' },
  capsule: { width: 7, height: 12, borderRadius: 5, borderWidth: 1.5, borderColor: colors.accentInk },
  arc: { position: 'absolute', top: 6, width: 13, height: 11, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, borderWidth: 1.5, borderTopWidth: 0, borderColor: colors.accentInk },
  stem: { position: 'absolute', top: 17, width: 1.5, height: 5, backgroundColor: colors.accentInk },
});
