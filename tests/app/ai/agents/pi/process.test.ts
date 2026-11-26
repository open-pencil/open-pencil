import { afterEach, describe, expect, test } from 'bun:test'

import type { HarnessCompactionEvent } from '@open-pencil/harness'

import { spawnHarnessProcess } from '@/app/ai/agents/pi/process'

import { clearTauriMocks, mockHost } from '#tests/helpers/tauri/mocks'

afterEach(async () => {
  await clearTauriMocks()
})

describe('Harness sidecar process', () => {
  test('hands the API key to the desktop app when it starts the companion, never over stdin', async () => {
    const host = await mockHost()
    const process = await spawnHarnessProcess({
      auth: { apiKey: 'secret' },
      onUnexpectedClose: () => undefined
    })
    await process.send({ id: 'one', method: 'service.shutdown' })

    expect(host.started[0]?.program).toEqual({ kind: 'harness', apiKey: 'secret' })
    const writes = host.calls.filter((call) => call.cmd === 'host_write')
    expect(writes).toHaveLength(1)
    expect(JSON.stringify(writes)).not.toContain('secret')
  })

  test('reads a response split across stdout chunks', async () => {
    const host = await mockHost()
    const process = await spawnHarnessProcess({
      auth: { agentDir: '/pi' },
      onUnexpectedClose: () => undefined
    })
    const reader = process.messages.getReader()
    const line = '\n' + JSON.stringify({ type: 'response', id: 'one', result: { ok: true } }) + '\n'
    host.emit({ type: 'stdout', data: line.slice(0, 12) })
    host.emit({ type: 'stdout', data: line.slice(12) })
    expect((await reader.read()).value).toEqual({
      type: 'response',
      id: 'one',
      result: { ok: true }
    })
  })

  test('passes on a compaction the agent reports', async () => {
    const host = await mockHost()
    const process = await spawnHarnessProcess({
      auth: {},
      onUnexpectedClose: () => undefined
    })
    const event: HarnessCompactionEvent = {
      type: 'compaction',
      trigger: 'manual',
      summary: 'Greeted.',
      tokensBefore: 1200
    }
    host.emit({
      type: 'stdout',
      data: `${JSON.stringify({ type: 'turn.event', id: 'turn', event })}\n`
    })
    expect((await process.messages.getReader().read()).value).toEqual({
      type: 'turn.event',
      id: 'turn',
      event
    })
  })
})
