import { MAX_AUDIO_BYTES, validateWav } from '../../../packages/voice/audio';

const ORIGIN = 'https://grow-ev-demo.dhossain.workers.dev';
const isAllowedOrigin = (origin: string | null): boolean =>
  origin === ORIGIN || (origin !== null && /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin));

export interface Env {
  AI: Ai;
  VOICE_RATE_LIMIT: RateLimit;
  VOICE_BUDGET: DurableObjectNamespace;
}

/** Anonymous guest API. CORS is browser policy, never proof of identity. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const headers = new Headers({ 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' });
    if (origin && isAllowedOrigin(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type');
      headers.set('Access-Control-Expose-Headers', 'Retry-After');
    }
    const reply = (status: number, error: string) => Response.json({ error }, { status, headers });
    if (new URL(request.url).pathname !== '/transcribe') return reply(404, 'NOT_FOUND');
    if (origin && !isAllowedOrigin(origin)) return reply(403, 'ORIGIN_DENIED');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') { headers.set('Allow', 'POST, OPTIONS'); return reply(405, 'METHOD_NOT_ALLOWED'); }
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'audio/wav') return reply(415, 'USE_PCM_WAV');
    const length = request.headers.get('Content-Length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_AUDIO_BYTES)) return reply(413, 'AUDIO_TOO_LARGE');
    // Cloudflare supplies this IP; no client-supplied forwarded header fallback.
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip || !env.VOICE_RATE_LIMIT || !env.VOICE_BUDGET || !env.AI) return reply(503, 'VOICE_UNAVAILABLE');
    try {
      if (!(await env.VOICE_RATE_LIMIT.limit({ key: ip })).success) {
        headers.set('Retry-After', '60'); return reply(429, 'RATE_LIMITED');
      }
    } catch { return reply(503, 'VOICE_UNAVAILABLE'); }
    let bytes: Uint8Array;
    try {
      if (!request.body) return reply(400, 'EMPTY_AUDIO');
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; void reader.cancel(); }, 10000);
      try {
        while (true) {
          const next = await reader.read(); if (next.done) break;
          size += next.value.length;
          if (size > MAX_AUDIO_BYTES) { await reader.cancel(); return reply(413, 'AUDIO_TOO_LARGE'); }
          chunks.push(next.value);
        }
      } finally { clearTimeout(timer); reader.releaseLock(); }
      if (timedOut) return reply(408, 'AUDIO_UPLOAD_TIMEOUT');
      bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      validateWav(bytes);
    } catch { return reply(400, 'INVALID_OR_EMPTY_AUDIO'); }
    try {
      const budget = env.VOICE_BUDGET.get(env.VOICE_BUDGET.idFromName('global'));
      const admission = await budget.fetch('https://budget/admit', { method: 'POST' });
      if (!admission.ok) { headers.set('Retry-After', '60'); return reply(429, 'VOICE_BUDGET_EXHAUSTED'); }
      // Documented object input: uint8 file bytes, not base64 or float samples.
      const result = await env.AI.run('@cf/openai/whisper', { audio: Array.from(bytes) });
      if (!result || typeof result.text !== 'string' || result.text.length > 2000) return reply(502, 'INVALID_TRANSCRIPTION');
      const text = result.text.trim();
      if (!text) return reply(422, 'NO_SPEECH');
      // This model's documented output does not contain reliable language metadata.
      return Response.json({ text }, { headers });
    } catch (failure) {
      const e = failure as { status?: number; code?: number };
      if (e.status === 429 || e.code === 3036) { headers.set('Retry-After', '60'); return reply(429, 'AI_QUOTA_EXHAUSTED'); }
      return reply(503, 'VOICE_UNAVAILABLE');
    }
  },
};

/** Serialized, persistent global allowance: at most 200 inference admissions per UTC day,
 * at most one every 3 seconds. Failed AI calls still consume an admission. */
export class VoiceBudget {
  constructor(private readonly state: DurableObjectState) {}
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/admit') return new Response(null, { status: 404 });
    const admitted = await this.state.storage.transaction(async (storage) => {
      const now = Date.now(), day = Math.floor(now / 86400000);
      const saved = await storage.get<{ day: number; count: number; last: number }>('budget');
      const current = saved?.day === day ? saved : { day, count: 0, last: 0 };
      if (current.count >= 200 || now - current.last < 3000) return false;
      await storage.put('budget', { day, count: current.count + 1, last: now });
      return true;
    });
    return new Response(null, { status: admitted ? 204 : 429 });
  }
}
