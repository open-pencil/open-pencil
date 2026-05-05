export function installTauriMockWindow() {
  const windowLike = globalThis as typeof globalThis & {
    __TAURI_INTERNALS__?: unknown
    __TAURI_EVENT_PLUGIN_INTERNALS__?: unknown
  }
  Object.assign(globalThis, { window: windowLike })
}

export async function mockTauriIPC(handler: (cmd: string, args: unknown) => unknown) {
  installTauriMockWindow()
  const { mockIPC } = await import('@tauri-apps/api/mocks')
  mockIPC(handler)
}

export async function clearTauriMocks() {
  if (!('window' in globalThis)) return
  const { clearMocks } = await import('@tauri-apps/api/mocks')
  clearMocks()
}
