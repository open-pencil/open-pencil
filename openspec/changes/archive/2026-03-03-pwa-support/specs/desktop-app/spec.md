## MODIFIED Requirements

### Requirement: Tauri v2 desktop shell
The editor SHALL run as a native desktop app via Tauri v2 with the web frontend loaded in a webview. The app identifier SHALL be `net.dannote.open-pencil`. When running inside the Tauri webview, the service worker SHALL NOT be registered to avoid intercepting Tauri IPC and native file system requests.

#### Scenario: Desktop app launch
- **WHEN** user runs `bun run tauri dev`
- **THEN** a native desktop window opens with the editor UI and CanvasKit rendering

#### Scenario: No service worker in Tauri
- **WHEN** the app loads inside the Tauri webview
- **THEN** `navigator.serviceWorker.register` is never called and no SW is active
