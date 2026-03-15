## Why

Users collaborating on a document in real-time need voice communication. Currently they must use external tools (Discord, Zoom) alongside OpenPencil. Built-in voice chat removes friction — users click one button and talk while designing together, same as Figma's audio feature.

## What Changes

- Add voice chat capability to collaboration sessions: users in the same room can opt-in to a voice call
- Capture microphone audio via `getUserMedia` and relay it over existing Trystero WebRTC peer connections (`room.addStream` / `room.onPeerStream`)
- Mute/unmute toggle with keyboard shortcut
- Speaking indicator on peer avatars (via `AnalyserNode` volume detection)
- Voice status broadcast through Yjs Awareness protocol

## Capabilities

### New Capabilities
- `voice-chat`: In-session voice communication between collaborating peers over WebRTC

### Modified Capabilities
- `editor-ui`: CollabPanel gets voice controls (join/leave call, mute toggle, speaking indicators on avatars)

## Impact

- `src/composables/use-collab.ts` — expose room media methods, add voice state
- New composable `src/composables/use-voice.ts` — microphone capture, audio playback, volume analysis
- `src/components/CollabPanel.vue` — voice UI controls and speaking indicators
- `src/constants.ts` — new constants for voice chat
- `src/stores/editor.ts` — voice-related state if needed
- Browser permission: `navigator.mediaDevices.getUserMedia({ audio: true })`
- No new dependencies — Trystero already supports media streams natively
