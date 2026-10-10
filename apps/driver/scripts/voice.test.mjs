import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const url = (code) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const compile = async (path) => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { parseCommand, commandFilters } = await import(url(await compile('../src/features/voice/commands.ts')));
const audioUrl = url(await compile('../../../packages/voice/audio.ts'));
const { encodeWav } = await import(audioUrl);
const { transcribe } = await import(url((await compile('../src/features/voice/api.ts')).replace("'../../../../../packages/voice/audio'", JSON.stringify(audioUrl))));
test('five commands and realistic Whisper punctuation map to existing connector/power requirements', () => {
  for (const text of ['Find CCS2 chargers', 'Find me a CCS2 charger.', 'Please find a CCS two charger!']) {
    assert.deepEqual(parseCommand(text), { kind: 'connector', standard: 'IEC_62196_T2_COMBO' });
  }
  assert.deepEqual(parseCommand('Find Type 2 chargers'), { kind: 'connector', standard: 'IEC_62196_T2' });
  assert.deepEqual(parseCommand('Find me a Type two charger.'), { kind: 'connector', standard: 'IEC_62196_T2' });
  assert.deepEqual(parseCommand('Find a fast charger'), { kind: 'fast' });
  assert.deepEqual(parseCommand('Find another available charger'), { kind: 'alternative' });
  assert.deepEqual(parseCommand('Show charging stations near me'), { kind: 'nearby' });
  assert.deepEqual(commandFilters(parseCommand('Find a fast charger'), {}, 'IEC_62196_T2'), { connectorStandards: ['IEC_62196_T2'], minPowerKw: 50 });
  assert.deepEqual(commandFilters(parseCommand('Find CCS2 chargers'), { minPowerKw: 150 }, 'CHADEMO'), { connectorStandards: ['IEC_62196_T2_COMBO'] });
});
test('unknown/negated/conflicting/compound requests never change charger filters', () => {
  for (const text of ['', 'hello', 'Do not find CCS2 chargers', 'Find CCS2 and Type 2 chargers', 'Find CCS2 chargers and delete data', 'CCS2', 'Find a cheap charger']) assert.equal(parseCommand(text), null);
});
test('transcription client reports network, quota, invalid-response and canceled failures', async () => {
  const original = globalThis.fetch;
  const audio = encodeWav(Float32Array.from({ length: 16000 }, (_, i) => Math.sin(i / 10)), 16000);
  try {
    for (const [reply, pattern] of [
      [async () => { throw new TypeError('offline'); }, /network/],
      [async () => new Response(null, { status: 429 }), /limit/],
      [async () => Response.json({ text: '' }), /Invalid/],
      [async () => new Response(null, { status: 503 }), /unavailable/],
    ]) { globalThis.fetch = reply; await assert.rejects(transcribe(audio, new AbortController().signal), pattern); }
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.headers['Content-Type'], 'audio/wav'); assert.equal(options.body, audio);
      if (options.signal.aborted) throw new Error('aborted');
      return Response.json({ text: 'Find me a CCS2 charger.' });
    };
    const text = await transcribe(audio, new AbortController().signal);
    assert.equal(parseCommand(text).standard, 'IEC_62196_T2_COMBO');
    const abort = new AbortController(); abort.abort(); await assert.rejects(transcribe(audio, abort.signal), /interrupted/);
    await assert.rejects(transcribe(new ArrayBuffer(0), abort.signal), /audio/);
  } finally { globalThis.fetch = original; }
});

const reactUrl = url('export const useRef = (value) => ({current:value});');
const expoUrl = url(`
export const RecordingPresets = {HIGH_QUALITY:{}};
export const requestRecordingPermissionsAsync = async () => ({granted:globalThis.voiceRecordingFixture.granted});
export const setAudioModeAsync = async () => {};
export const useAudioRecorder = () => globalThis.voiceRecordingFixture.recorder;
export const useAudioStream = (options) => { globalThis.voiceRecordingFixture.options=options; return {stream:globalThis.voiceRecordingFixture.stream}; };
`);
const recorderModule = async (path) => import(url((await compile(path))
  .replace("'expo-audio'", JSON.stringify(expoUrl)).replace("'react'", JSON.stringify(reactUrl))
  .replace("'../../../../../packages/voice/audio'", JSON.stringify(audioUrl))));
const { useRecording: nativeRecording } = await recorderModule('../src/features/voice/useRecording.ts');
const { useRecording: webRecording } = await recorderModule('../src/features/voice/useRecording.web.ts');
test('native recording permission denial never starts capture; PCM capture encodes WAV and cancels', async () => {
  let starts = 0, stops = 0;
  globalThis.voiceRecordingFixture = { granted: false, stream: { start: async () => { starts++; }, stop: () => { stops++; } } };
  try {
    const recorder = nativeRecording();
    await assert.rejects(recorder.start(), /permission denied/); assert.equal(starts, 0);
    globalThis.voiceRecordingFixture.granted = true; await recorder.start();
    globalThis.voiceRecordingFixture.options.onBuffer({ channels: 1, sampleRate: 48000, data: Float32Array.from({ length: 48000 }, (_, i) => Math.sin(i / 10)).buffer });
    assert.equal((await recorder.finish()).byteLength, 32044); assert.equal(starts, 1); assert.ok(stops > 0);
    await recorder.start(); await recorder.cancel(); await assert.rejects(recorder.finish(), /Record between/);
  } finally { delete globalThis.voiceRecordingFixture; }
});
test('browser recording rejects unavailable/denied microphone and really decodes before WAV encoding', async () => {
  const keys = ['navigator','MediaRecorder','AudioContext','fetch'];
  const saved = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let preparations = 0, decoded = 0, stopped = 0;
  const recorder = { uri: 'blob:fixture', isRecording: false, prepareToRecordAsync: async () => { preparations++; }, record() { this.isRecording = true; }, stop: async () => { recorder.isRecording = false; stopped++; } };
  const set = (key, value) => Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  try {
    set('navigator', { mediaDevices: {} });
    globalThis.voiceRecordingFixture = { granted: false, recorder };
    const recording = webRecording();
    await assert.rejects(recording.start(), /unavailable/);
    set('navigator', { mediaDevices: { getUserMedia() {} } }); set('MediaRecorder', class {});
    set('AudioContext', class {
      async decodeAudioData() { decoded++; return { length: 48000, numberOfChannels: 1, sampleRate: 48000, getChannelData: () => Float32Array.from({length:48000}, (_,i) => Math.sin(i/10)) }; }
      async close() {}
    });
    await assert.rejects(recording.start(), /permission denied/); assert.equal(preparations,0);
    globalThis.voiceRecordingFixture.granted = true; await recording.start();
    set('fetch', async () => new Response(new Uint8Array([1,2,3])));
    const wav = await recording.finish(); assert.equal(wav.byteLength,32044); assert.equal(decoded,1); assert.equal(stopped,1);
    await recording.start(); await recording.cancel(); assert.equal(stopped,2);
  } finally {
    for (const key of keys) { if(saved[key])Object.defineProperty(globalThis,key,saved[key]);else delete globalThis[key]; }
    delete globalThis.voiceRecordingFixture;
  }
});
