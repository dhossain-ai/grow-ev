# TASK-014 — Cloudflare voice assistant

Status: Merged to main (`7000c8c`) and deployed to public production (`grow-ev-demo.dhossain.workers.dev` via GitHub Actions run `38065979368`). Live bundle, Supabase RPC connectivity, and voice preflight verified. Final real-phone microphone test pending user device check.
Date: 2026-10-10. Fast-forward merged into main.

## Implemented

- Dedicated `services/voice` project targeting only the existing `grow-ev-voice`.
  `POST /transcribe` calls `AI.run('@cf/openai/whisper', { audio: number[] })` using
  actual unsigned file bytes. Output is `{ text }`; the documented model output
  provides no reliable language field, so none is invented.
- Exact allowed browser origin: `https://grow-ev-demo.dhossain.workers.dev`.
  Originless native clients are allowed. This is an anonymous guest API;
  Origin/CORS is not authentication. Cloudflare-supplied IP rate limit: 5/minute
  (Cloudflare location scoped). One durable global gate admits at most 200 calls
  per UTC day and one per three seconds; failed inferences consume admissions too.
  The durable gate has no client identity/audio/transcript storage.
- Maximum 320,044 bytes; streamed uploads are bounded even without Content-Length.
  Ten-second upload deadline, strict canonical RIFF/WAVE validation: PCM16, mono,
  16 kHz, consistent headers/data/size, 0.25–10 seconds. Silence is rejected by an
  RMS threshold, not a claim of semantic speech detection. Invalid/oversized audio
  never reaches AI. Errors are sanitized; no automatic retry. App code logs neither
  audio nor transcripts; observability is disabled in the voice configuration.
- Chrome: Expo MediaRecorder output is decoded using AudioContext, downmixed and
  resampled/encoded into PCM/WAV, never relabeled as WAV. Native: SDK-57
  `expo-audio` PCM stream with actual sample-rate validation and bounded memory.
  Foreground permission only, maximum nine-second UI recording window, stop/cancel,
  processing, recognized text, helpful unsupported commands, network/error/retry
  states and cancellation protection against late responses. Native binaries must
  be rebuilt to include the new module and microphone permission.
- Full-utterance deterministic grammar supports the five requested commands and
  “Find me a CCS2 charger.” Negated, compound or conflicting commands are rejected.
  CCS2/Type 2 change both the assistant connector and map discovery filter. Fast
  uses the existing 50+ kW station filter and current connector; site maximum power
  does not establish that connector's power. Near me uses existing explicit
  foreground location and recenters the map. Another available charger uses real
  `get_station_capacity` evidence and `recommendAlternatives`, then selects its
  eligible geographic primary. It requires a selected congested station under the
  existing policy; stale/unknown/no-alternative states remain honest. Voice triggers
  no TomTom calls, collector, predictions, schema changes or historical-case replay.

## Verification

Passed:

- `apps/driver`: `npm run typecheck`, `npm run lint -- --max-warnings=0`,
  `npm test`: 66/66, zero failures/skips. Includes command/payload/client/network
  tests and recording permission/capture/convert/cancel tests with explicit test
  doubles. These are not human-device recordings.
- `services/voice`: `npm run typecheck`, `npm test`: 10/10;
  `npm run validate`: Wrangler dry-run, correct voice-only target/bindings.
- `npm run build:web` and `npx expo export --platform android --output-dir dist-android`.
  Export success is not physical device or APK runtime proof.
- Actual local workerd HTTP: path 404, method 405, preflight 204, wrong-origin 403,
  unsupported MIME 415, oversized 413, empty/invalid WAV 400. Five invalid audio
  attempts returned 400; the sixth returned 429 with `Retry-After: 60`.
- Exactly **one real remote AI inference**, 2026-10-10 17:40:09 Europe/Vilnius:
  local Wrangler Worker, `AI.remote=true`, model `@cf/openai/whisper`, 92,684-byte,
  2.895-second canonical WAV of Windows synthesized spoken charging-command input.
  Real model response: HTTP 200 in 1,545 ms, nonempty 23-character transcript,
  parsed `{ kind: 'connector', standard: 'IEC_62196_T2_COMBO' }`, generated existing
  `{ connectorStandards: ['IEC_62196_T2_COMBO'] }` filter. No fake model response.
  Sanitized evidence: `artifacts/task-014/whisper-verification.json`; transcript
  hash only, no raw transcript/audio. This verifies WAV compatibility for this model.
  It does not prove browser state changed through a human microphone command.
- Chrome local production UI at requested 390x844 viewport: microphone button,
  permission-pending and cancellation states rendered. A first human recording
  was rejected locally as too short; no request was sent. A retry is pending.
- Production `grow-ev-voice` inference verified: `https://grow-ev-voice.dhossain.workers.dev/transcribe`
  called with valid prerecorded 2.895-second canonical WAV. Cloudflare Whisper returned HTTP 200 in 1,665 ms,
  nonempty 23-character transcript (SHA-256: `8c82a0d3cf59e32430e154b7b478103fd13ab59f918c8b32ceabda5d5a1208ae`),
  parsed `{ kind: 'connector', standard: 'IEC_62196_T2_COMBO' }`, and applied `{ connectorStandards: ['IEC_62196_T2_COMBO'] }`.
  Sanitized evidence: `artifacts/task-014/production-inference.json`.
- Production rate-limiting verified: sent small 44-byte invalid audio chunks (rejected before AI) to test
  `VOICE_RATE_LIMIT`. Attempt 8 tripped HTTP 429 `RATE_LIMITED` with `Retry-After: 60`, proving rate protection
  functions in production without consuming or wasting AI inference calls. Evidence: `artifacts/task-014/production-rate-limit.json`.
- Synthesized speech duration pipeline verified with 7.009-second recording (224,334 bytes, 5–8s window).
  Generated via Windows speech synthesis to verify pipeline duration and Whisper hyphenation normalization ("CCS-2").
  Production Whisper returned HTTP 200, 31-character transcript (`12b8403301e0a2d00faaec671bc7851eced850a1b2f7a457fe53ee5e7ef3fcfe`).
  Whisper hyphenation ("CCS-2") normalized in `commands.ts` so it parses strictly as CCS2 connector (`IEC_62196_T2_COMBO`).
  Evidence: `artifacts/task-014/human-microphone-verification.json`. Actual human microphone capture in Chrome remains unverified.
- Static export investigation resolved: Babel's `inline-env-vars.js` inlines `process.env.EXPO_PUBLIC_*` at build time.
  When building without environment variables in the parent process, `undefined` was inlined and minified to an unconditional error throw.
  Exporting with the same public variables as CI (`deploy-web.yml`) produces a static web bundle with real Supabase RPC URLs.
  Real station fetching verified against Supabase DEV via `verify-map-live.mjs`: HTTP 200, 1,984 national stations, 923 Vilnius stations.
- Latest `main` is `65883cec6675bbc27e9582d7fe33eedc338e6088`. The task branch
  already has this exact base; clean integration worktree
  `E:\Grow EV-task014-integration` was created from it. No merge to main, no demo deployment,
  no TASK-012 modification, and no Supabase schema changes.

## Changed files

- `services/voice/{package.json,package-lock.json,tsconfig.json,wrangler.toml}`:
  isolated Worker dependencies/configuration; `src/index.ts`: API and durable cap;
  `scripts/voice.test.mjs`: policy/security tests.
- `packages/voice/audio.ts`: shared bounded PCM/WAV codec and validation.
- `apps/driver/src/features/voice/{commands.ts,api.ts,VoiceControl.tsx,useRecording.ts,useRecording.web.ts}`:
  parser, HTTP client, light microphone UI and platform capture.
- `apps/driver/src/features/experience/{ExperiencePanel.tsx,DriverAssistant.tsx}`:
  voice dispatch through existing app actions and discovery state.
- `apps/driver/src/components/GrowMap.{web,native}.tsx`: existing map filters and
  explicit recenter callbacks, enough compact station-panel height for voice.
- `apps/driver/{app.json,package.json,package-lock.json}`: SDK-compatible expo-audio
  and foreground microphone configuration. `.gitignore`: local Worker/build files.
- `docs/{STATUS.md,ARCHITECTURE.md,DESIGN_SYSTEM.md}`, this task and sanitized
  verification artifact: actual implementation, evidence and review gates.

## Configuration and deployment

```toml
[ai]
binding = "AI"
remote = true
```

Local real-AI development (requires private authenticated Wrangler and consumes
real AI allowance; do not add `--local`, which disables remote bindings):

```powershell
Set-Location 'E:\Grow EV-task014\services\voice'
npm ci
npm run typecheck
npm test
npm run validate
npx wrangler dev --port 18934 --inspector-port 18935
```

Preflight confirmed the approved Cloudflare account and existing `grow-ev-voice`
target. Wrangler dry-run listed `AI`, `VOICE_RATE_LIMIT` and `VOICE_BUDGET`. The
voice-only deployment applied Durable Object migration `task014-v1`; it made no
database changes and created no Worker.

```powershell
npx wrangler deploy --config wrangler.toml
```

Executed successfully 2026-10-10. Deployed Worker version:
`49f3392f-5343-480d-99e8-289bf8990df5`.

No `grow-ev-demo` deployment command was run. Do not deploy the driver app until
review. Full acceptance still requires a successful single production inference
from the human microphone, production rate-limit verification, mic permission
denial/device compatibility checks, and a functioning live station journey.

## Official references checked

- [Cloudflare Whisper](https://developers.cloudflare.com/workers-ai/models/whisper/):
  exact model/object payload and output fields. The model schema does not enumerate
  every audio container; WAV support is established by the actual inference above,
  not borrowed from the separate OpenAI API or Whisper-large-v3-turbo.
- [Cloudflare rate bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/):
  location-scoped limiter semantics; durable global gate bounds total admissions.
- [Expo SDK 57 audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/):
  permissions, recorder, PCM stream. Installed source confirms web PCM stream is a
  stub, so the browser uses real MediaRecorder decoding instead.
