import { afterEach, describe, expect, test, vi } from 'bun:test'

import { createACPTransport } from '@/app/ai/chat/transports'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(async () => {
  await clearTauriMocks()
  vi.restoreAllMocks()
  Reflect.deleteProperty(globalThis, 'window')
})

/** The transport keeps `cwd` private, so the spawned value is read structurally. */
function cwdOf(transport: object): string | null {
  return 'cwd' in transport && typeof transport.cwd === 'string' ? transport.cwd : null
}

describe('Tauri ACP transport', () => {
  test('uses Tauri home directory for transport cwd', async () => {
    await mockTauriIPC((cmd, args) => {
      expect(cmd).toBe('plugin:path|resolve_directory')
      expect(args).toEqual({ directory: 21 })
      return '/Users/tester'
    })

    const transport = await createACPTransport('acp:claude-code')

    expect(cwdOf(transport)).toBe('/Users/tester')
  })
})
