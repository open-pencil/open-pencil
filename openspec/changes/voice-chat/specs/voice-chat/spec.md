## ADDED Requirements

### Requirement: Voice call join and leave
The system SHALL allow users in a collaboration room to join a voice call. Joining captures the local microphone via `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })` and sends the audio stream to all peers via `room.addStream()`. Leaving the call stops the local microphone track, removes the stream from peers, and cleans up audio elements.

#### Scenario: Join voice call
- **WHEN** user clicks the microphone button while connected to a collaboration room
- **THEN** the browser requests microphone permission, the local audio stream is captured and sent to all peers, and the button changes to indicate active call state

#### Scenario: Leave voice call
- **WHEN** user clicks the active microphone button (or the hang-up button) while in a voice call
- **THEN** the local microphone track is stopped, the stream is removed from peers, remote audio elements are cleaned up, and the button returns to inactive state

#### Scenario: Microphone permission denied
- **WHEN** user clicks the microphone button but denies the browser permission prompt
- **THEN** a toast message is shown explaining that microphone access is needed, and the user remains in the collaboration room without voice

#### Scenario: Disconnect from room while in voice call
- **WHEN** user disconnects from the collaboration room while a voice call is active
- **THEN** the voice call is automatically cleaned up (mic stopped, audio elements removed)

### Requirement: Mute and unmute
The system SHALL allow users in a voice call to mute and unmute their microphone. Muting disables the local audio track without stopping it. The mute state is broadcast via Awareness.

#### Scenario: Mute microphone
- **WHEN** user clicks the mute button or presses M while in a voice call
- **THEN** the local audio track is disabled (muted), the awareness state updates to `muted: true`, and peers see the muted indicator

#### Scenario: Unmute microphone
- **WHEN** user clicks the unmute button or presses M while muted
- **THEN** the local audio track is enabled, the awareness state updates to `muted: false`

### Requirement: Speaking detection
The system SHALL detect when a user is speaking by analyzing audio volume via `AnalyserNode`. A user is considered speaking when the average frequency data exceeds a configurable threshold. The speaking state is broadcast via Awareness for the local user.

#### Scenario: Speaking detected
- **WHEN** user speaks into the microphone while in a voice call and not muted
- **THEN** the awareness state updates to `speaking: true` and peers see the speaking indicator

#### Scenario: Silence after speaking
- **WHEN** user stops speaking
- **THEN** the awareness state updates to `speaking: false` after a brief debounce

#### Scenario: Muted user is never speaking
- **WHEN** user is muted
- **THEN** the speaking state is always `false` regardless of microphone input

### Requirement: Remote audio playback
The system SHALL play remote peers' audio streams through dynamically created `HTMLAudioElement` instances. Each peer's stream gets its own audio element. Audio elements are removed when a peer leaves or the call ends.

#### Scenario: Receive peer audio
- **WHEN** a remote peer joins the voice call and sends their audio stream
- **THEN** an audio element is created, assigned the peer's stream, and begins playback

#### Scenario: Peer leaves call
- **WHEN** a remote peer leaves the voice call or disconnects
- **THEN** their audio element is removed and cleaned up

### Requirement: Voice state in Awareness
The system SHALL broadcast voice state via Yjs Awareness protocol with the field `voice: { inCall: boolean, muted: boolean, speaking: boolean }`. This state is read by the UI to render indicators.

#### Scenario: Voice state broadcast on join
- **WHEN** user joins a voice call
- **THEN** awareness updates with `voice: { inCall: true, muted: false, speaking: false }`

#### Scenario: Voice state cleared on leave
- **WHEN** user leaves a voice call
- **THEN** awareness updates with `voice: { inCall: false, muted: false, speaking: false }`
