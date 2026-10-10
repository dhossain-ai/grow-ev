import { MAX_AUDIO_BYTES, validateWav } from '../../../../../packages/voice/audio';

export async function transcribe(audio: ArrayBuffer, signal: AbortSignal): Promise<string> {
  if (audio.byteLength > MAX_AUDIO_BYTES) throw new Error('Recording too large. Try a shorter command.');
  try { validateWav(new Uint8Array(audio)); } catch { throw new Error('No clear audio recorded. Please speak and try again.'); }
  let response: Response;
  try {
    response = await fetch('https://grow-ev-voice.dhossain.workers.dev/transcribe', {
      method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: audio, signal,
    });
  } catch { throw new Error('Voice request interrupted or network unavailable. Please retry.'); }
  if (response.status === 429) throw new Error('Voice request limit reached. Wait at least a minute before retrying; the daily allowance may be exhausted.');
  if (!response.ok) throw new Error(response.status === 400 || response.status === 422 ? 'No clear speech recognized. Please retry.' : 'Voice service unavailable. Please retry later.');
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('text' in data) || typeof data.text !== 'string' || !data.text.trim() || data.text.length > 2000) throw new Error('Invalid voice response. Please retry.');
  return data.text.trim();
}
