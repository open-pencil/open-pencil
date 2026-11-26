import { afterEach, describe, expect, test, vi } from 'bun:test'

import { spawnACPProcess } from '@/app/ai/agents/acp/process'

import { clearTauriMocks, mockHost } from '#tests/helpers/tauri/mocks'

afterEach(async () => {
  await clearTauriMocks()
  vi.restoreAllMocks()
})

function startCodex(options: { refusesTools?: boolean; onUnexpectedClose?: () => void } = {}) {
  return spawnACPProcess({
    agent: 'codex',
    refusesTools: options.refusesTools,
    logId: 'test',
    destroying: () => false,
    onUnexpectedClose: options.onUnexpectedClose ?? vi.fn()
  })
}

describe('ACP agent process', () => {
  test('asks the desktop app for the agent by name, and whether it refuses tools', async () => {
    const host = await mockHost()
    await startCodex()
    await startCodex({ refusesTools: true })
    expect(host.started.map((start) => start.program)).toEqual([
      { kind: 'agent', agent: 'codex', refusesTools: false },
      { kind: 'agent', agent: 'codex', refusesTools: true }
    ])
  })

  test('streams stdout and stdin through the started program and stops it', async () => {
    const host = await mockHost()
    const process = await startCodex()

    const reader = process.output.getReader()
    host.emit({ type: 'stdout', data: '{"id":1}\n' })
    const chunk = await reader.read()
    expect(new TextDecoder().decode(chunk.value)).toBe('{"id":1}\n')

    const writer = process.input.getWriter()
    await writer.write(new TextEncoder().encode('{"id":2}\n'))
    await process.child.kill()

    expect(host.calls.filter((call) => call.cmd !== 'host_start')).toEqual([
      { cmd: 'host_write', args: { id: 1, data: '{"id":2}\n' } },
      { cmd: 'host_kill', args: { id: 1 } }
    ])
  })

  test('signals unexpected ACP process close to the output stream', async () => {
    const host = await mockHost()
    const onUnexpectedClose = vi.fn()
    const process = await startCodex({ onUnexpectedClose })
    const reader = process.output.getReader()

    host.emit({ type: 'close', code: 1, signal: null })

    await expect(reader.read()).rejects.toThrow('Agent process exited unexpectedly.')
    expect(onUnexpectedClose).toHaveBeenCalled()
  })

  test('delivers what the agent wrote before it exited, then the exit', async () => {
    const host = await mockHost()
    const process = await startCodex()
    host.emit({ type: 'stdout', data: 'last\n' })
    host.emit({ type: 'close', code: 1, signal: null })

    const reader = process.output.getReader()
    const chunk = await reader.read()
    expect(new TextDecoder().decode(chunk.value)).toBe('last\n')
    await expect(reader.read()).rejects.toThrow('Agent process exited unexpectedly.')
  })

  test('passes on that the agent waits in the permission window', async () => {
    const host = await mockHost()
    const onPermission = vi.fn()
    await spawnACPProcess({
      agent: 'codex',
      logId: 'test',
      destroying: () => false,
      onUnexpectedClose: vi.fn(),
      onPermission
    })
    host.emit({ type: 'permission', title: 'Run tests', waiting: true })
    expect(onPermission).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Run tests', waiting: true })
    )
  })
})
