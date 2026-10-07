import { afterEach, describe, expect, test } from 'bun:test'

import { requestRestartApproval } from '@/app/shell/updater/restart'

import { clearTauriMocks, installTauriMockWindow } from '#tests/helpers/tauri/mocks'

async function mockWindows(labels: () => string[]) {
  installTauriMockWindow()
  const { mockIPC } = await import('@tauri-apps/api/mocks')
  mockIPC(
    (cmd) => {
      if (cmd === 'plugin:window|get_all_windows') return labels()
      return null
    },
    { shouldMockEvents: true }
  )
}

afterEach(async () => {
  await clearTauriMocks()
})

describe('requestRestartApproval', () => {
  test('approves when no editor window is open', async () => {
    await mockWindows(() => ['updater'])

    await expect(requestRestartApproval()).resolves.toBe(true)
  })

  test('approves once the editor window closes instead of waiting for a reply', async () => {
    await mockWindows(() => ['main', 'updater'])
    const { emit, TauriEvent } = await import('@tauri-apps/api/event')

    const approval = requestRestartApproval()
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    await emit(TauriEvent.WINDOW_DESTROYED)

    await expect(approval).resolves.toBe(true)
  })

  test('approves when the editor closes before its close event is watched', async () => {
    let lookups = 0
    await mockWindows(() => (++lookups === 1 ? ['main', 'updater'] : ['updater']))

    await expect(requestRestartApproval()).resolves.toBe(true)
  })
})
