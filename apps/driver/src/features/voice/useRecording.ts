import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';
import { useRef } from 'react';
import { encodeWav, MAX_SECONDS } from '../../../../../packages/voice/audio';

/** Native PCM capture is memory-only; no persistent audio file. */
export function useRecording() {
  const chunks = useRef<Float32Array[]>([]);
  const count = useRef(0);
  const rate = useRef(16000);
  const capturing = useRef(false);
  const invalid = useRef(false);
  const { stream } = useAudioStream({ sampleRate: 16000, channels: 1, encoding: 'float32', onBuffer: (buffer) => {
    if (!capturing.current) return;
    if (buffer.channels !== 1 || (count.current && buffer.sampleRate !== rate.current)) { invalid.current = true; return; }
    rate.current = buffer.sampleRate;
    const samples = new Float32Array(buffer.data);
    const remaining = Math.max(0, Math.floor(rate.current * MAX_SECONDS) - count.current);
    const copy = samples.slice(0, remaining);
    chunks.current.push(copy); count.current += copy.length;
  } });
  const cancel = async () => { capturing.current = false; stream.stop(); chunks.current = []; count.current = 0; await setAudioModeAsync({ allowsRecording: false }); };
  return {
    async start() {
      if (!(await requestRecordingPermissionsAsync()).granted) throw new Error('Microphone permission denied. Enable it in app settings, then retry.');
      chunks.current = []; count.current = 0; invalid.current = false;
      await setAudioModeAsync({ allowsRecording: true, allowsBackgroundRecording: false });
      capturing.current = true;
      try { await stream.start(); } catch (error) { await cancel(); throw error; }
    },
    async finish() {
      capturing.current = false; stream.stop();
      try {
        if (invalid.current) throw new Error('Microphone encoding changed. Please retry.');
        const samples = new Float32Array(count.current); let offset = 0;
        for (const chunk of chunks.current) { samples.set(chunk, offset); offset += chunk.length; }
        return encodeWav(samples, rate.current);
      } finally { await cancel(); }
    },
    cancel,
  };
}
