import type { Page } from '@playwright/test'

type ClipboardWrite = {
  args: unknown
  cmd: string
}

export type TauriClipboardSnapshot = {
  html: string
  text: string
  writes: ClipboardWrite[]
}

export type TauriClipboardMock = {
  rejectHTMLWrites: () => void
  snapshot: () => TauriClipboardSnapshot
}

const IPC_BINDING = '__playwrightTauriIPC'

/**
 * What the desktop app's own commands return on a machine with no system fonts, no pending files
 * or rooms, and no stored credentials. Any other command fails the spec, so a new one is noticed.
 */
const APP_COMMAND_RESULTS: Record<string, unknown> = {
  list_system_fonts: [],
  take_pending_open: [],
  take_pending_rooms: [],
  credential_status: 'missing',
  load_system_font: null,
  set_native_menu_checked: null,
  'plugin:event|listen': null,
  'plugin:event|unlisten': null,
  'plugin:process|exit': null,
  'plugin:process|restart': null
}

export async function installTauriClipboardMock(page: Page): Promise<TauriClipboardMock> {
  const state: TauriClipboardSnapshot = {
    text: '',
    html: '',
    writes: []
  }
  let rejectHTMLWrites = false

  await page.exposeBinding(IPC_BINDING, (_, cmd: string, args?: Record<string, unknown>) => {
    state.writes.push({ cmd, args })
    switch (cmd) {
      case 'plugin:clipboard-manager|write_html': {
        if (rejectHTMLWrites) throw new Error('Clipboard write failed')
        state.html = String(args?.html ?? '')
        state.text = String(args?.altText ?? state.html)
        return null
      }
      case 'plugin:clipboard-manager|write_text': {
        state.text = String(args?.text ?? '')
        state.html = ''
        return null
      }
      case 'plugin:clipboard-manager|read_text':
        return state.html || state.text
      default:
        if (Object.hasOwn(APP_COMMAND_RESULTS, cmd)) return APP_COMMAND_RESULTS[cmd]
        throw new Error(`Unexpected Tauri command: ${cmd}`)
    }
  })

  await page.addInitScript((bindingName) => {
    const binding: unknown = Reflect.get(globalThis, bindingName)
    if (typeof binding !== 'function')
      throw new Error(`Playwright binding not found: ${bindingName}`)
    const invoke = binding as (cmd: string, args?: Record<string, unknown>) => Promise<unknown>

    let callbackId = 1
    const callbacks = new Map<number, unknown>()
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {
        callbacks,
        metadata: {
          currentWindow: { label: 'main' },
          currentWebview: { label: 'main' }
        },
        convertFileSrc: (filePath: string) => filePath,
        invoke,
        transformCallback: (callback: unknown) => {
          const id = callbackId++
          callbacks.set(id, callback)
          return id
        },
        unregisterCallback: (id: number) => {
          callbacks.delete(id)
        },
        runCallback: () => null
      }
    })
  }, IPC_BINDING)

  return {
    rejectHTMLWrites: () => {
      rejectHTMLWrites = true
    },
    snapshot: () => structuredClone(state)
  }
}
