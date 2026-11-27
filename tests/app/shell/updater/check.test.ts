import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test'

import { createDeferred } from '@open-pencil/std/async'
import { useMessages } from '@open-pencil/vue/i18n'

import {
  appPreferences,
  DEFAULT_APP_PREFERENCES,
  updateStartupUpdateCheck,
  updateUpdateChannel
} from '@/app/settings/preferences/store'
import { toast } from '@/app/shell/ui'
import {
  checkForAppUpdate,
  resetStartupUpdateCheckForTests,
  scheduleStartupUpdateCheck,
  STARTUP_UPDATE_CHECK_DELAY_MS
} from '@/app/shell/updater/check'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

const messages = useMessages('updates')

const AVAILABLE_UPDATE = {
  rid: 9,
  currentVersion: '0.11.8',
  version: '0.11.9',
  date: null,
  body: '### Fixed\n\n- Release notes',
  rawJson: '{}'
}

function restorePreferences(): void {
  appPreferences.value = structuredClone(DEFAULT_APP_PREFERENCES)
}

beforeEach(() => {
  restorePreferences()
  resetStartupUpdateCheckForTests()
})

afterEach(async () => {
  jest.useRealTimers()
  if ('window' in globalThis) {
    Reflect.deleteProperty(globalThis.window, '__OPENPENCIL_DESKTOP_CAPABILITIES__')
  }
  await clearTauriMocks()
  for (const entry of toast.toasts.value) toast.remove(entry.id)
  restorePreferences()
  resetStartupUpdateCheckForTests()
})

describe('checkForAppUpdate', () => {
  test('does nothing in a package that turns self-update off', async () => {
    const calls: string[] = []
    await mockTauriIPC((cmd) => {
      calls.push(cmd)
      return AVAILABLE_UPDATE
    })
    Object.defineProperty(window, '__OPENPENCIL_DESKTOP_CAPABILITIES__', {
      value: Object.freeze({ selfUpdate: false, hostProcesses: true }),
      configurable: true
    })

    await checkForAppUpdate({ messages })

    expect(calls).toEqual([])
    expect(toast.toasts.value).toEqual([])
  })

  test('asks the channel the preference names, or the installed build’s', async () => {
    const asked: unknown[] = []
    await mockTauriIPC((cmd, args) => {
      if (cmd === 'check_for_update') asked.push(args)
      return null
    })

    await checkForAppUpdate({ silent: true, messages })
    updateUpdateChannel('nightly')
    await checkForAppUpdate({ silent: true, messages })

    // Tests run as 0.0.0-test, a stable-channel build.
    expect(asked).toEqual([{ channel: 'stable' }, { channel: 'nightly' }])
  })

  test('returns quietly when no update is available', async () => {
    const calls: string[] = []
    await mockTauriIPC((cmd) => {
      calls.push(cmd)
      return null
    })

    await checkForAppUpdate({ silent: true, messages })

    expect(calls).toEqual(['check_for_update'])
    expect(toast.toasts.value).toEqual([])
  })

  test('says the app is up to date when asked from the menu', async () => {
    await mockTauriIPC(() => null)

    await checkForAppUpdate({ messages })

    expect(toast.toasts.value.map((entry) => entry.message)).toEqual([messages.value.upToDate])
  })

  test('shows the answer to Check for Updates asked while the launch check runs', async () => {
    const { promise: pending, resolve: answer } = createDeferred<null>()
    let asked = 0
    await mockTauriIPC((cmd) => {
      if (cmd !== 'check_for_update') return null
      asked += 1
      return pending
    })

    const launch = checkForAppUpdate({ silent: true, messages })
    const menu = checkForAppUpdate({ messages })
    answer(null)
    await Promise.all([launch, menu])

    expect(asked).toBe(1)
    expect(toast.toasts.value.map((entry) => entry.message)).toEqual([messages.value.upToDate])
  })

  test('asks the desktop app to open the Software Update window for an available update', async () => {
    const calls: Array<{ cmd: string; args: unknown }> = []
    await mockTauriIPC((cmd, args) => {
      calls.push({ cmd, args })
      if (cmd === 'check_for_update') return AVAILABLE_UPDATE
      return null
    })

    await checkForAppUpdate({ silent: true, messages })

    const opened = calls.find((call) => call.cmd === 'open_updater_window')
    expect(opened?.args).toEqual({ title: messages.value.windowTitle })
    // The editor creates no window itself.
    expect(calls.map((call) => call.cmd)).not.toContain('plugin:webview|create_webview_window')
    // The window checks again for its own handle; this one is released.
    expect(calls.map((call) => call.cmd)).toContain('plugin:resources|close')
  })

  test('reports a failed check from the menu', async () => {
    await mockTauriIPC((cmd) => {
      if (cmd === 'check_for_update') throw new Error('offline')
      return null
    })

    await checkForAppUpdate({ messages })

    expect(toast.toasts.value.map((entry) => entry.message)).toEqual([
      messages.value.checkFailed({ error: 'offline' })
    ])
  })
})

describe('scheduleStartupUpdateCheck', () => {
  test('checks silently once the launch delay has passed', async () => {
    const calls: string[] = []
    await mockTauriIPC((cmd) => {
      calls.push(cmd)
      return null
    })
    jest.useFakeTimers()

    const pending = scheduleStartupUpdateCheck(messages)
    jest.advanceTimersByTime(STARTUP_UPDATE_CHECK_DELAY_MS - 1)
    await Promise.resolve()
    expect(calls).toEqual([])

    jest.advanceTimersByTime(1)
    await pending
    expect(calls).toEqual(['check_for_update'])
    expect(toast.toasts.value).toEqual([])
  })

  test('skips the request when startup checks are turned off before it runs', async () => {
    const calls: string[] = []
    await mockTauriIPC((cmd) => {
      calls.push(cmd)
      return null
    })
    jest.useFakeTimers()

    const pending = scheduleStartupUpdateCheck(messages)
    updateStartupUpdateCheck(false)
    jest.advanceTimersByTime(STARTUP_UPDATE_CHECK_DELAY_MS)
    await pending

    expect(calls).toEqual([])
  })

  test('still checks from the menu when startup checks are off', async () => {
    const calls: string[] = []
    await mockTauriIPC((cmd) => {
      calls.push(cmd)
      return null
    })
    updateStartupUpdateCheck(false)

    await checkForAppUpdate({ messages })

    expect(calls).toEqual(['check_for_update'])
    expect(toast.toasts.value.map((entry) => entry.message)).toEqual([messages.value.upToDate])
  })
})
