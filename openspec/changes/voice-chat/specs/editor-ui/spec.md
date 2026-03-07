## ADDED Requirements

### Requirement: Voice chat controls in CollabPanel
The CollabPanel SHALL display voice chat controls when connected to a collaboration room. Controls include: a microphone button to join/leave the voice call, and a mute toggle button visible when in a call. The microphone button uses `icon-lucide-mic` / `icon-lucide-mic-off` icons.

#### Scenario: Voice controls visible when connected
- **WHEN** user is connected to a collaboration room
- **THEN** a microphone button appears in the CollabPanel

#### Scenario: Voice controls hidden when disconnected
- **WHEN** user is not connected to a collaboration room
- **THEN** no voice controls are shown

#### Scenario: In-call controls
- **WHEN** user is in a voice call
- **THEN** the microphone button shows active state and a mute toggle is visible

### Requirement: Speaking indicator on peer avatars
Peer avatars in the CollabPanel SHALL display a pulsing ring animation when the peer is speaking. The ring color matches the peer's assigned color. Muted peers show a muted icon overlay instead.

#### Scenario: Peer speaking indicator
- **WHEN** a remote peer is speaking (awareness `voice.speaking: true`)
- **THEN** their avatar shows a pulsing ring animation in their peer color

#### Scenario: Peer muted indicator
- **WHEN** a remote peer is in the call but muted
- **THEN** their avatar shows a small muted microphone icon overlay

#### Scenario: Peer not in call
- **WHEN** a remote peer is not in the voice call
- **THEN** their avatar shows normally without any voice indicators

### Requirement: Mute keyboard shortcut
The editor SHALL support M as a keyboard shortcut to toggle mute while in a voice call. The shortcut SHALL only activate when not editing text and when in a voice call.

#### Scenario: Toggle mute via keyboard
- **WHEN** user presses M while in a voice call and not editing text
- **THEN** the microphone mute state toggles
