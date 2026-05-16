export function installTauriMockWindow() {
  const windowLike = globalThis as typeof globalThis & {
    __TAURI_INTERNALS__?: unknown
    __TAURI_EVENT_PLUGIN_INTERNALS__?: unknown
  }
  Object.assign(globalThis, { window: windowLike })
}

export async function mockTauriIPC(
  handler: (cmd: string, args: unknown, options?: unknown) => unknown
) {
  installTauriMockWindow()
  const { mockIPC } = await import('@tauri-apps/api/mocks')
  mockIPC(handler)
  const windowLike = window as typeof window & {
    __TAURI_INTERNALS__: {
      invoke: (cmd: string, args: unknown, options?: unknown) => Promise<unknown>
    }
  }
  windowLike.__TAURI_INTERNALS__.invoke = async (cmd, args, options) => handler(cmd, args, options)
}

export async function clearTauriMocks() {
  if (!('window' in globalThis)) return
  const { clearMocks } = await import('@tauri-apps/api/mocks')
  clearMocks()
  delete (globalThis as typeof globalThis & { window?: unknown }).window
}
