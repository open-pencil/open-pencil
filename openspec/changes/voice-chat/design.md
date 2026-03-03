## Context

OpenPencil has real-time collaboration via Trystero (WebRTC over MQTT signaling) with Yjs CRDT for document sync and Awareness for cursor/selection presence. The existing `Room` object from Trystero already supports `addStream`/`removeStream`/`onPeerStream` for media streams over the same peer connections used for data. No additional WebRTC infrastructure is needed.

## Goals / Non-Goals

**Goals:**
- Let users in a collaboration room join/leave a voice call with one click
- Show who is speaking via visual indicators on peer avatars
- Support mute/unmute with a keyboard shortcut (M)
- Broadcast voice status through existing Awareness protocol
- Clean up audio resources on disconnect/leave

**Non-Goals:**
- Video chat — audio only for now
- Noise cancellation or audio processing beyond basic volume detection
- Push-to-talk mode (always-on with mute toggle is simpler)
- Persisting voice state — voice call is ephemeral per session
- Screen sharing

## Decisions

### 1. Separate `use-voice` composable

Voice logic lives in a new `src/composables/use-voice.ts` rather than expanding `use-collab.ts`. Rationale: `use-collab` already handles Yjs sync, awareness, and cursor broadcasting (~310 lines). Voice is a distinct concern (mic capture, audio playback, volume analysis) that uses the room but doesn't touch Yjs. The composable receives the Trystero `Room` reference from collab.

Alternative: Inline everything in `use-collab.ts` — rejected because it would bloat the file and mix document sync with media concerns.

### 2. MediaStream via Trystero native API

Use `room.addStream(localStream)` to send audio and `room.onPeerStream(callback)` to receive. Trystero handles renegotiation and track management internally. This avoids manually touching `RTCPeerConnection` objects.

Alternative: Manual `addTrack`/`removeTrack` on peer connections from `room.getPeers()` — rejected because Trystero's stream API handles the complexity and works for all peers including late joiners.

### 3. Volume detection via AnalyserNode

Create an `AudioContext` + `AnalyserNode` per stream (local and each remote) to detect speaking. Poll `getByteFrequencyData()` at ~60fps via `requestAnimationFrame`. A peer is "speaking" when average frequency exceeds a threshold. This drives the visual indicator on avatars.

Alternative: WebRTC `getStats()` `audioLevel` — rejected because it requires polling RTCPeerConnection stats per peer, and Trystero abstracts away the connections.

### 4. Audio playback via HTMLAudioElement

Remote audio streams are played through dynamically created `<audio>` elements (one per peer). This is simpler than routing through AudioContext for playback and handles device output routing automatically.

### 5. Voice state in Awareness

Broadcast `voice: { inCall: boolean, muted: boolean, speaking: boolean }` via `awareness.setLocalStateField('voice', ...)`. Remote peers read this from awareness states to render UI indicators. This reuses the existing awareness transport — no new Trystero actions needed.

### 6. Injection pattern matches collab

Export `VOICE_KEY` as `InjectionKey` and `useVoiceInjected()` for child components, matching the `COLLAB_KEY` / `useCollabInjected()` pattern.

## Risks / Trade-offs

- **Microphone permission denied** → Graceful fallback: show toast explaining the permission is needed, don't crash. User stays in collab without voice.
- **Echo/feedback** → Browser's built-in AEC (Acoustic Echo Cancellation) via `echoCancellation: true` in getUserMedia constraints. Not perfect on all devices but good enough without external processing.
- **Late joiner doesn't hear existing audio** → Trystero's `addStream` re-sends to new peers in `onPeerJoin`. Verified in Trystero docs: streams are automatically shared with new peers.
- **Multiple tabs** → Each tab captures its own mic. Browser handles this; no special handling needed.
- **Mobile browser support** → `getUserMedia` is supported on iOS Safari 14.5+ and Android Chrome. No special concerns.
