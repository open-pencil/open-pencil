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
      case 'list_system_fonts':
      case 'take_pending_open':
        return []
      case 'load_system_font':
      case 'plugin:event|listen':
      case 'plugin:event|unlisten':
      case 'plugin:process|exit':
      case 'plugin:process|restart':
        return null
      default:
        throw new Error(`Unexpected Tauri command: ${cmd}`)
    }
  })

  await page.addInitScript((bindingName) => {
    const invoke = (
      globalThis as typeof globalThis & {
        [key: string]: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
      }
    )[bindingName]
    if (!invoke) throw new Error(`Playwright binding not found: ${bindingName}`)

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
