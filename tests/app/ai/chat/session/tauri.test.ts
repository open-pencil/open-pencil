import { afterEach, describe, expect, test, vi } from 'bun:test'

import { createACPTransport } from '@/app/ai/chat/session'

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
  test('starts the agent in the folder the desktop shell sets aside for agents', async () => {
    const workspace = '/Users/tester/Library/Application Support/OpenPencil/agent-workspace'
    await mockTauriIPC((cmd) => {
      expect(cmd).toBe('agent_workspace')
      return workspace
    })

    const transport = await createACPTransport('acp:claude-code')

    expect(cwdOf(transport)).toBe(workspace)
  })
})
