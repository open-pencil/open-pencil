# Ideas Backlog

This file collects possible future contributions. Items here are ideas, not committed roadmap work.

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
