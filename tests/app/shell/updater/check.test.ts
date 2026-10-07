import { afterEach, describe, expect, test } from 'bun:test'

import { useI18n } from '@open-pencil/vue'

import { toast } from '@/app/shell/ui'
import { checkForAppUpdate } from '@/app/shell/updater/check'
import { UPDATER_WINDOW_LABEL, UPDATER_WINDOW_URL } from '@/app/shell/updater/window'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

const { updates: messages } = useI18n()

const AVAILABLE_UPDATE = {
  rid: 9,
  currentVersion: '0.11.8',
  version: '0.11.9',
  date: null,
  body: '### Fixed\n\n- Release notes',
  rawJson: '{}'
}

afterEach(async () => {
  await clearTauriMocks()
  for (const entry of toast.toasts.value) toast.remove(entry.id)
})

describe('checkForAppUpdate', () => {
  test('returns quietly when no update is available', async () => {
    const calls: string[] = []
    await mockTauriIPC((cmd) => {
      calls.push(cmd)
      return null
    })

    await checkForAppUpdate({ silent: true, messages })

    expect(calls).toEqual(['plugin:updater|check'])
    expect(toast.toasts.value).toEqual([])
  })

  test('says the app is up to date when asked from the menu', async () => {
    await mockTauriIPC(() => null)

    await checkForAppUpdate({ messages })

    expect(toast.toasts.value.map((entry) => entry.message)).toEqual([messages.value.upToDate])
  })

  test('opens the Software Update window for an available update', async () => {
    const calls: Array<{ cmd: string; args: unknown }> = []
    await mockTauriIPC((cmd, args) => {
      calls.push({ cmd, args })
      if (cmd === 'plugin:updater|check') return AVAILABLE_UPDATE
      if (cmd === 'plugin:window|get_all_windows') return ['main']
      return null
    })

    await checkForAppUpdate({ silent: true, messages })

    const created = calls.find((call) => call.cmd === 'plugin:webview|create_webview_window')
    expect(created?.args).toMatchObject({
      options: {
        label: UPDATER_WINDOW_LABEL,
        url: UPDATER_WINDOW_URL,
        title: messages.value.windowTitle
      }
    })
    // The window checks again for its own handle; this one is released.
    expect(calls.map((call) => call.cmd)).toContain('plugin:resources|close')
  })

  test('focuses the Software Update window when it is already open', async () => {
    const calls: string[] = []
    await mockTauriIPC((cmd) => {
      calls.push(cmd)
      if (cmd === 'plugin:updater|check') return AVAILABLE_UPDATE
      if (cmd === 'plugin:window|get_all_windows') return ['main', UPDATER_WINDOW_LABEL]
      return null
    })

    await checkForAppUpdate({ messages })

    expect(calls).toContain('plugin:window|set_focus')
    expect(calls).not.toContain('plugin:webview|create_webview_window')
  })

  test('reports a failed check from the menu', async () => {
    await mockTauriIPC((cmd) => {
      if (cmd === 'plugin:updater|check') throw new Error('offline')
      return null
    })

    await checkForAppUpdate({ messages })

    expect(toast.toasts.value.map((entry) => entry.message)).toEqual([
      messages.value.checkFailed({ error: 'offline' })
    ])
  })
})
