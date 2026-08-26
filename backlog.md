# Contribution Backlog

This file records planned, intentionally narrow contributions as well as future ideas. Each pull
request should be cut from the current `master` in a clean checkout and should avoid carrying
unrelated WIP changes.

## Working-copy strategy

Keep two separate local repositories:

- **WIP repository** (`open-pencil`): the long-lived `victorwads/local-ai-improves` branch holds the
  combined, exploratory work. It is a safe place to integrate upstream changes, resolve broad
  conflicts once, and preserve unfinished ideas without making it reviewable as one pull request.
- **PR repository** (`open-pencil-pr-fast-pages-recent`): a clean clone used only to create focused
  branches from the current upstream `master`. For each contribution, bring across only the required
  files or commits from WIP, validate it independently, then open its PR from this checkout.

Do not turn the WIP branch itself into a PR. After a focused PR merges, bring the resulting upstream
changes back into WIP through the normal `master` merge so the two histories converge naturally.

## Planned pull requests

### 1. AI chat improvements

**Status:** Next candidate, after the currently open PRs are merged.

Bring only the self-contained chat improvements from the WIP branch. Keep this separate from local
MCP lifecycle UI, i18n, performance work, and `.fig` rendering changes so it has a focused review
surface and minimal conflicts.

### 2. Local MCP server controls

**Status:** Follow-up after the chat PR.

Add a dedicated settings surface for the local MCP server:

- Show whether it is running and the active port.
- Provide start, stop, and restart controls where the runtime supports them.
- Keep server lifecycle and status handling isolated from general chat changes.

### 3. Further performance improvements

**Status:** After the focused feature PRs.

Continue the performance work in its own PR, including the worker-related controls and any
measurable loading or memory improvements. Establish the exact scope from the remaining WIP diff
when it is time to cut the branch.

### 5. `.fig` rendering compatibility fixes

**Status:** After a broader validation pass.

Validate roughly 50 additional pages across a varied set of `.fig` files, catalog remaining broken
component/rendering cases, and submit one rendering-only PR with the verified fixes and targeted
regression tests.

## Future ideas

## Voice input with a configurable Whisper API

**Status:** Future idea

**UI exploration:** Settings now includes a non-persisted Audio assignment row for evaluating the
layout. It defaults to None and intentionally has no Same as Design option.

Add a microphone button to the AI chat so users can dictate design instructions.

### Possible approach

- Add an optional **Audio** model role alongside Design, Review, Fast, and Vision.
- Let users configure an OpenAI-compatible Whisper transcription endpoint, model, and credentials.
- Use the existing `Transcription` API type for profiles backed by `/audio/transcriptions`.
- Keep the integration provider-agnostic so it can work with OpenAI or locally hosted Whisper APIs.
- Record audio from the microphone, send it to the configured transcription endpoint, and place the
  resulting text in the AI chat input for review before submission.
- Treat hosting and running a local transcription service as the user's responsibility.

### Model capabilities

Represent model input modalities independently from agent features:

- **Text input** — enabled by default. Store it as an optional `textInput` profile setting where
  `null` or `undefined` means enabled and only explicit `false` disables it, avoiding a migration of
  existing profiles.
- **Image input** — already represented by the current Vision capability.
- **Audio input** — required for models used by the Audio role.
- **Tool calling** — remains a separate feature capability rather than an input modality.

Future output capabilities may need the same distinction, especially **Text output** and **Audio
output**. A transcription-only profile would typically have Audio input and Text output, without Text
input or Tool calling.

### Proposed technical design

Use a dedicated transcription adapter instead of routing microphone recordings through Chat
Completions or Responses:

```ts
type TranscriptionRequest = {
  audio: Blob
  model: string
  language?: string
  prompt?: string
  signal?: AbortSignal
}

type TranscriptionResult = {
  text: string
}

interface AudioTranscriptionAdapter {
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>
}
```

The first adapter should implement the OpenAI-compatible transcription contract:

```http
POST {baseURL}/audio/transcriptions
Content-Type: multipart/form-data

file=<recorded audio blob>
model=<configured model ID>
response_format=json
language=<optional language code>
prompt=<optional transcription hint>
```

The expected JSON response is:

```json
{ "text": "transcribed instruction" }
```

Implementation notes:

- Call the endpoint with a direct `fetch` adapter; it is separate from the existing Vercel AI SDK
  Chat/Responses model adapters.
- Reuse the existing provider connection, base URL, and centralized credential manager where
  possible, but let the Audio role select a different model profile.
- Record with `MediaRecorder`, prefer a broadly accepted browser format such as WebM/Opus, and keep
  format normalization isolated so local Whisper servers with narrower format support can be added.
- Keep recorded audio in memory, send it only to the configured endpoint, and discard it after the
  request completes unless the user explicitly chooses otherwise.
- Insert the returned transcript into the chat composer as an editable draft. Do not submit it
  automatically in the first version.
- Expose recording, transcribing, retry, cancel, permission-denied, and endpoint-error states in the
  microphone UI.
- Require CORS from local endpoints in the browser build; the Tauri build can use its native fetch
  path when browser CORS is unavailable.
- Treat realtime partial transcription as a later adapter using the Realtime transcription API,
  rather than complicating the initial file-based flow.

### OpenAI compatibility basis

- [`whisper-1`](https://developers.openai.com/api/docs/models/whisper-1) accepts audio input, produces
  text, and supports `v1/audio/transcriptions`.
- [`gpt-4o-transcribe`](https://developers.openai.com/api/docs/models/gpt-4o-transcribe) is another
  speech-to-text model supported by the transcription endpoint.
- General audio conversation models are a different integration: models such as
  [`gpt-audio`](https://developers.openai.com/api/docs/models/gpt-audio) accept audio through Chat
  Completions and can also produce audio, but that is unnecessary for microphone-to-text dictation.

### Open questions

- Which Whisper-compatible request formats should be supported initially?
- Should recording stop manually, after silence detection, or support both?
- Should transcription be inserted as a draft or sent automatically?
- How should microphone permission, recording state, errors, and unavailable endpoints appear in the
  interface?
- Should audio remain only in memory and be discarded immediately after transcription?
