import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from 'expo-audio';
import { useRef } from 'react';
import { encodeWav } from '../../../../../packages/voice/audio';

/** Decode the browser's actual container, then encode canonical PCM/WAV. Never relabel WebM. */
export function useRecording() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const uri = useRef<string | null>(null);
  const clear = () => { if (uri.current) URL.revokeObjectURL(uri.current); uri.current = null; };
  return {
    async start() {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined' || typeof AudioContext === 'undefined') throw new Error('Voice recording is unavailable in this browser. Use Chrome over HTTPS.');
      if (!(await requestRecordingPermissionsAsync()).granted) throw new Error('Microphone permission denied. Enable it in site settings, then retry.');
      clear();
      await recorder.prepareToRecordAsync(); recorder.record();
    },
    async finish() {
      await recorder.stop(); uri.current = recorder.uri;
      if (!uri.current) throw new Error('No audio recorded. Please retry.');
      const context = new AudioContext();
      try {
        const blob = await (await fetch(uri.current)).blob();
        if (blob.size > 2_000_000 || !blob.size) throw new Error('Invalid recording size. Please retry.');
        const audio = await context.decodeAudioData(await blob.arrayBuffer());
        const mono = new Float32Array(audio.length);
        for (let channel = 0; channel < audio.numberOfChannels; channel++) {
          const samples = audio.getChannelData(channel);
          for (let i = 0; i < mono.length; i++) mono[i] += samples[i] / audio.numberOfChannels;
        }
        return encodeWav(mono, audio.sampleRate);
      } finally { await context.close(); clear(); }
    },
    async cancel() { if (recorder.isRecording) await recorder.stop(); uri.current = recorder.uri; clear(); },
  };
}
