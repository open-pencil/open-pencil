## 1. Constants and Types

- [x] 1.1 Add voice-related constants to `src/constants.ts`: `VOICE_SPEAKING_THRESHOLD` (dB level for getFloatFrequencyData), `VOICE_SPEAKING_DEBOUNCE_MS` (silence debounce ~200ms), `VOICE_DETECTION_INTERVAL_MS` (polling interval ~100ms)
- [x] 1.2 Add `VoiceState` interface to `use-voice.ts`: `{ inCall: boolean, muted: boolean, speaking: boolean }`
- [x] 1.3 Extend `RemotePeer` interface in `use-collab.ts` with optional `voice?: VoiceState` field

## 2. Voice Composable

- [x] 2.1 Create `src/composables/use-voice.ts` with `useVoice()` accepting the collab return type (which exposes room methods and awareness). Return reactive `voiceState`, `joinCall()`, `leaveCall()`, `toggleMute()`. Export `VOICE_KEY` as `InjectionKey` and `useVoiceInjected()` helper matching collab injection pattern.
- [x] 2.2 Implement `joinCall()`: call `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })`. Store local `MediaStream`. Call `room.addStream(stream)` and handle the returned `Promise<void>[]` via `Promise.allSettled()`. Set awareness `voice: { inCall: true, muted: false, speaking: false }`. Register `onPeerJoin` handler that calls `room.addStream(localStream, newPeerId)` for late joiners.
- [x] 2.3 Implement `leaveCall()`: stop all tracks on local stream, call `room.removeStream(stream)`, remove all remote `<audio>` elements from the peerAudioElements map, close the `AudioContext`, clear the detection interval, set awareness `voice: { inCall: false, muted: false, speaking: false }`
- [x] 2.4 Implement `toggleMute()`: toggle `track.enabled` on local audio track, update awareness `muted` field. When muting, also set `speaking: false`.
- [x] 2.5 Implement speaking detection: create `AudioContext` (call `resume()` since it's inside user-gesture-triggered `joinCall`), connect `AnalyserNode` to local stream via `MediaStreamSource`. Use `setInterval` at `VOICE_DETECTION_INTERVAL_MS` (~100ms). Use `getFloatFrequencyData()` and compare average dB level to `VOICE_SPEAKING_THRESHOLD`. Debounce silence by `VOICE_SPEAKING_DEBOUNCE_MS` before setting `speaking: false`. Skip detection when muted.
- [x] 2.6 Implement remote audio playback: call `room.onPeerStream()` — for each incoming stream, check if a `<audio>` element already exists for that peerId in the `Map<string, HTMLAudioElement>`. If yes, replace its `srcObject`. If no, create a new element with `autoplay = true` and `srcObject = stream`. Handle `play()` promise rejection (autoplay policy) by logging — WebRTC streams are usually exempt but Safari may not be.
- [x] 2.7 Implement peer leave cleanup: when a peer disconnects, remove and clean up that peer's audio element from the map (pause, clear srcObject, remove from DOM)
- [x] 2.8 Handle `getUserMedia` errors: catch `NotAllowedError` and `NotFoundError`, show toast via existing `toast.show()` from `use-toast`, don't enter call state

## 3. Collab Integration

- [x] 3.1 Expose controlled access to Room media methods from `use-collab.ts`: expose a `roomRef` (a `shallowRef<Room | null>`) that `use-voice` can read. Alternatively expose specific methods `addStream`/`removeStream`/`onPeerStream`/`onPeerJoin` as forwarding functions — prefer the narrower API to prevent accidental `room.leave()` calls.
- [x] 3.2 Read `voice` field from awareness states in `updatePeersList()` and populate `RemotePeer.voice`
- [x] 3.3 Wire `leaveCall()` into collab `disconnect()` — voice must clean up before `room.leave()` is called

## 4. UI — CollabPanel Voice Controls

- [x] 4.1 Add microphone button to `CollabPanel.vue` visible when `state.connected` is true. Use `icon-lucide-mic` (not in call), `icon-lucide-mic-off` (muted), green accent background (in call, unmuted). Clicking toggles join/leave call.
- [x] 4.2 When in call, show mute/unmute toggle inline (the same mic button changes meaning: click to toggle mute, long-press or separate button to leave)
- [x] 4.3 Add speaking indicator on peer avatars: pulsing ring animation via Tailwind (`ring-2 animate-pulse`) in peer color when `peer.voice?.speaking` is true
- [x] 4.4 Add muted indicator on peer avatars: small `icon-lucide-mic-off` overlay (absolute positioned, bottom-right corner) when `peer.voice?.muted && peer.voice?.inCall`
- [x] 4.5 Add speaking indicator on local user avatar when local voice state shows speaking

## 5. Keyboard Shortcut

- [x] 5.1 Add M keyboard shortcut in `use-keyboard.ts` to toggle mute. Guard: voice `inCall` is true + `store.state.activeTool !== 'TEXT'` + no active text editing + not focused on an input/textarea. Check existing shortcuts to confirm M is not already bound.

## 6. EditorView Wiring

- [x] 6.1 Create `useVoice(collab)` in `EditorView.vue`, `provide(VOICE_KEY, voice)`. Use injection in CollabPanel and MobileHud via `useVoiceInjected()` — no prop drilling for voice state.
- [x] 6.2 In CollabPanel/MobileHud, use `useVoiceInjected()` to access voice controls directly rather than passing props/events up through EditorView
