import { afterEach, expect, test } from 'bun:test'

import { clearTauriMocks, installTauriMockWindow, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(clearTauriMocks)

test('clearing IPC mocks removes runtime markers before reinstalling a window', async () => {
  await mockTauriIPC(() => null)
  expect('__TAURI_INTERNALS__' in window).toBe(true)

  await clearTauriMocks()
  installTauriMockWindow()

  expect('__TAURI_INTERNALS__' in window).toBe(false)
  expect('__TAURI_EVENT_PLUGIN_INTERNALS__' in window).toBe(false)
})
