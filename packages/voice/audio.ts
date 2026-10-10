/** A deliberately narrow wire format: 16 kHz, mono, 16-bit PCM RIFF/WAVE. */
export const SAMPLE_RATE = 16000;
export const MAX_SECONDS = 10;
export const MAX_AUDIO_BYTES = 44 + SAMPLE_RATE * 2 * MAX_SECONDS;

export function encodeWav(samples: Float32Array, inputRate: number): ArrayBuffer {
  if (!Number.isFinite(inputRate) || inputRate < 8000 || inputRate > 192000 ||
      samples.length / inputRate < 0.25 || samples.length / inputRate > MAX_SECONDS) {
    throw new Error('Record between 0.25 and 10 seconds.');
  }
  const count = Math.floor(samples.length * SAMPLE_RATE / inputRate);
  const result = new ArrayBuffer(44 + count * 2);
  const view = new DataView(result);
  const tag = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  tag(0, 'RIFF'); view.setUint32(4, result.byteLength - 8, true); tag(8, 'WAVE');
  tag(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  tag(36, 'data'); view.setUint32(40, count * 2, true);
  // Average each source interval when downsampling; interpolate when upsampling.
  for (let i = 0; i < count; i++) {
    const start = i * inputRate / SAMPLE_RATE;
    const end = (i + 1) * inputRate / SAMPLE_RATE;
    let value = 0;
    if (inputRate >= SAMPLE_RATE) {
      for (let j = Math.floor(start); j < Math.ceil(end); j++) {
        value += (samples[j] ?? 0) * (Math.min(end, j + 1) - Math.max(start, j));
      }
      value /= end - start;
    } else {
      const j = Math.floor(start), fraction = start - j;
      value = samples[j] * (1 - fraction) + (samples[j + 1] ?? samples[j]) * fraction;
    }
    if (!Number.isFinite(value)) throw new Error('Invalid microphone samples.');
    value = Math.max(-1, Math.min(1, value));
    view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return result;
}

export function validateWav(bytes: Uint8Array): void {
  if (bytes.length < 44 || bytes.length > MAX_AUDIO_BYTES) throw new Error('Invalid audio size');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  // Only canonical PCM, no extra/trailing chunks or ambiguous duration metadata.
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || tag(12) !== 'fmt ' || tag(36) !== 'data' ||
      v.getUint32(4, true) !== bytes.length - 8 || v.getUint32(16, true) !== 16 ||
      v.getUint16(20, true) !== 1 || v.getUint16(22, true) !== 1 ||
      v.getUint32(24, true) !== SAMPLE_RATE || v.getUint32(28, true) !== SAMPLE_RATE * 2 ||
      v.getUint16(32, true) !== 2 || v.getUint16(34, true) !== 16 ||
      v.getUint32(40, true) !== bytes.length - 44 || (bytes.length - 44) % 2) throw new Error('Unsupported WAV encoding');
  const duration = (bytes.length - 44) / (SAMPLE_RATE * 2);
  if (duration < 0.25 || duration > MAX_SECONDS) throw new Error('Invalid recording duration');
  let energy = 0;
  for (let i = 44; i < bytes.length; i += 2) energy += (v.getInt16(i, true) / 32768) ** 2;
  if (Math.sqrt(energy / ((bytes.length - 44) / 2)) < 0.001) throw new Error('No audible recording');
}
