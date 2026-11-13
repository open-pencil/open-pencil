export function installTauriMockWindow() {
  Object.assign(globalThis, { window: globalThis })
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
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
  Reflect.deleteProperty(window, '__TAURI_EVENT_PLUGIN_INTERNALS__')
  Reflect.deleteProperty(globalThis, 'window')
}

/** An event plugin-shell sends a spawned process's listeners, such as `Stdout` or `Terminated`. */
export type ShellEvent = { event: string; payload: unknown }

/** Delivers events to the process a mocked `plugin:shell|spawn` call started. */
export function shellEvents(spawnArgs: unknown): (event: ShellEvent) => void {
  const { onEvent } = spawnArgs as { onEvent: { onmessage: (event: ShellEvent) => void } }
  return (event) => onEvent.onmessage(event)
}
