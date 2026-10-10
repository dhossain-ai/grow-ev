import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const url = (code) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const compile = async (path) => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const audioUrl = url(await compile('../../../packages/voice/audio.ts'));
const { encodeWav, validateWav, MAX_AUDIO_BYTES } = await import(audioUrl);
const { default: worker, VoiceBudget } = await import(url((await compile('../src/index.ts')).replace("'../../../packages/voice/audio'", JSON.stringify(audioUrl))));
// Synthetic waveform and test doubles verify policy/payload only, never speech recognition.
const wav = () => encodeWav(Float32Array.from({ length: 16000 }, (_, i) => Math.sin(i / 10) * 0.1), 16000);
const origin = 'https://grow-ev-demo.dhossain.workers.dev';
function fixture(overrides = {}) {
  let calls = 0;
  const env = {
    AI: { run: async (model, input) => {
      calls++; assert.equal(model, '@cf/openai/whisper');
      assert.deepEqual(Object.keys(input), ['audio']); validateWav(Uint8Array.from(input.audio));
      return { text: ' Find me a CCS2 charger. ', language: 'untrusted-test-value' };
    } },
    VOICE_RATE_LIMIT: { limit: async ({ key }) => { assert.equal(key, '192.0.2.1'); return { success: true }; } },
    VOICE_BUDGET: { idFromName: (name) => name, get: () => ({ fetch: async () => new Response(null, { status: 204 }) }) },
    ...overrides,
  };
  const send = (options = {}) => worker.fetch(new Request('https://voice.invalid/transcribe', {
    method: 'POST', body: wav(), ...options,
    headers: { 'Content-Type': 'audio/wav', 'CF-Connecting-IP': '192.0.2.1', Origin: origin, ...options.headers },
  }), env);
  return { env, send, calls: () => calls };
}
test('canonical WAV with exact documented uint8 payload returns text only', async () => {
  const f = fixture(), response = await f.send();
  assert.equal(response.status, 200); assert.equal(f.calls(), 1);
  assert.deepEqual(await response.json(), { text: 'Find me a CCS2 charger.' });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('CORS accepts only the actual origin and local dev; originless native clients still require rate protection', async () => {
  const f = fixture();
  assert.equal((await f.send({ headers: { Origin: 'https://attacker.invalid' } })).status, 403);
  assert.equal((await f.send({ headers: { Origin: 'http://localhost:8081' } })).status, 200);
  assert.equal(f.calls(), 1);
  const request = new Request('https://voice.invalid/transcribe', { method: 'POST', body: wav(), headers: { 'Content-Type': 'audio/wav', 'CF-Connecting-IP': '192.0.2.1' } });
  assert.equal((await worker.fetch(request, f.env)).status, 200);
});
test('OPTIONS, GET and wrong paths never invoke AI', async () => {
  const f = fixture();
  assert.equal((await f.send({ method: 'OPTIONS', body: undefined })).status, 204);
  const get = await f.send({ method: 'GET', body: undefined });
  assert.equal(get.status, 405); assert.equal(get.headers.get('Allow'), 'POST, OPTIONS');
  assert.equal((await worker.fetch(new Request('https://voice.invalid/'), f.env)).status, 404);
  assert.equal(f.calls(), 0);
});
test('empty/silent/short/forged WAV, wrong sample rate and compressed formats are rejected before AI', async () => {
  const f = fixture();
  for (const body of [new ArrayBuffer(0), new ArrayBuffer(44), encodeWav(new Float32Array(16000), 16000)]) {
    assert.equal((await f.send({ body })).status, 400);
  }
  for (const [offset, value] of [[20, 3], [22, 2], [24, 48000], [40, 999]]) {
    const body = wav(); new DataView(body).setUint32(offset, value, true);
    assert.equal((await f.send({ body })).status, 400);
  }
  for (const mime of ['audio/webm', 'audio/mp4', 'application/json']) {
    assert.equal((await f.send({ headers: { 'Content-Type': mime } })).status, 415);
  }
  assert.equal(f.calls(), 0);
});
test('declared oversized and chunked oversized requests stop before inference', async () => {
  const f = fixture();
  assert.equal((await f.send({ headers: { 'Content-Length': String(MAX_AUDIO_BYTES + 1) } })).status, 413);
  assert.equal((await f.send({ body: new Uint8Array(MAX_AUDIO_BYTES + 1) })).status, 413);
  assert.equal(f.calls(), 0);
});
test('IP limit and durable budget exhaustion return 429/Retry-After before inference', async () => {
  for (const override of [
    { VOICE_RATE_LIMIT: { limit: async () => ({ success: false }) } },
    { VOICE_BUDGET: { idFromName: (x) => x, get: () => ({ fetch: async () => new Response(null, { status: 429 }) }) } },
  ]) {
    const f = fixture(override), response = await f.send();
    assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '60'); assert.equal(f.calls(), 0);
  }
});
test('missing binding/IP and infrastructure failure fail closed', async () => {
  for (const override of [{ AI: undefined }, { VOICE_BUDGET: undefined }, { VOICE_RATE_LIMIT: { limit: async () => { throw new Error('private'); } } }]) {
    const f = fixture(override); assert.equal((await f.send()).status, 503); assert.equal(f.calls(), 0);
  }
});
test('quota and provider errors are sanitized; bad or empty transcripts never succeed', async () => {
  for (const [run, status] of [
    [async () => { throw { status: 429, message: 'private' }; }, 429],
    [async () => { throw new Error('private'); }, 503],
    [async () => ({ text: '' }), 422], [async () => ({}), 502],
  ]) {
    const response = await fixture({ AI: { run } }).send();
    assert.equal(response.status, status); assert.ok(!(await response.text()).includes('private'));
  }
});
test('WAV encoding resamples 48k/44.1k/8k, preserves duration and enforces ten seconds', () => {
  for (const rate of [8000, 16000, 44100, 48000]) {
    const samples = Float32Array.from({ length: rate }, (_, i) => Math.sin(i / 10) * 0.1);
    const bytes = new Uint8Array(encodeWav(samples, rate)); validateWav(bytes); assert.equal(bytes.length, 32044);
  }
  assert.throws(() => encodeWav(new Float32Array(160001), 16000));
  assert.throws(() => encodeWav(new Float32Array(1), 16000));
});
test('persistent global admission budget survives new object instances and resets next UTC day', async () => {
  const records = new Map();
  const storage = { get: async (key) => records.get(key), put: async (key, value) => records.set(key, value), transaction: async (fn) => fn(storage) };
  const request = new Request('https://budget/admit', { method: 'POST' });
  const original = Date.now; let now = 86400000;
  Date.now = () => now;
  try {
    assert.equal((await new VoiceBudget({ storage }).fetch(request)).status, 204);
    assert.equal((await new VoiceBudget({ storage }).fetch(request)).status, 429);
    for (let i = 1; i < 200; i++) { now += 3000; assert.equal((await new VoiceBudget({ storage }).fetch(request)).status, 204); }
    now += 3000; assert.equal((await new VoiceBudget({ storage }).fetch(request)).status, 429);
    now = 2 * 86400000; assert.equal((await new VoiceBudget({ storage }).fetch(request)).status, 204);
  } finally { Date.now = original; }
});
