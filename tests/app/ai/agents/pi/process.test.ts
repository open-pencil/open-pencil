import { afterEach, describe, expect, test } from 'bun:test'

import type { HarnessCompactionEvent } from '@open-pencil/harness'

import { spawnHarnessProcess } from '@/app/ai/agents/pi/process'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(async () => {
  await clearTauriMocks()
})

describe('Harness sidecar process', () => {
  test('spawns the optional companion and keeps credentials in process environment', async () => {
    let onEvent: ((event: unknown) => void) | undefined
    const calls: Array<{ cmd: string; args: unknown }> = []
    await mockTauriIPC((cmd, args) => {
      calls.push({ cmd, args })
      if (cmd === 'plugin:shell|spawn') {
        expect(args).toMatchObject({
          program: 'openpencil-harness',
          args: [],
          options: {
            encoding: 'raw',
            env: { OPENPENCIL_HARNESS_API_KEY: 'secret' }
          }
        })
        onEvent = (args as { onEvent: { onmessage: (event: unknown) => void } }).onEvent.onmessage
        return 45
      }
      return null
    })

    const process = await spawnHarnessProcess({
      environment: { OPENPENCIL_HARNESS_API_KEY: 'secret' },
      onUnexpectedClose: () => undefined
    })
    await process.send({ id: 'one', method: 'service.shutdown' })

    const reader = process.messages.getReader()
    const encoded = new TextEncoder().encode(
      '\n' + JSON.stringify({ type: 'response', id: 'one', result: { ok: true } }) + '\n'
    )
    onEvent?.({ event: 'Stdout', payload: Array.from(encoded.slice(0, 12)) })
    onEvent?.({ event: 'Stdout', payload: Array.from(encoded.slice(12)) })
    expect((await reader.read()).value).toEqual({
      type: 'response',
      id: 'one',
      result: { ok: true }
    })

    expect(
      JSON.stringify(calls.find((call) => call.cmd === 'plugin:shell|stdin_write'))
    ).not.toContain('secret')
  })

  test('passes on a compaction the agent reports', async () => {
    let onEvent: ((event: unknown) => void) | undefined
    await mockTauriIPC((cmd, args) => {
      if (cmd === 'plugin:shell|spawn') {
        onEvent = (args as { onEvent: { onmessage: (event: unknown) => void } }).onEvent.onmessage
        return 47
      }
      return null
    })
    const process = await spawnHarnessProcess({
      environment: {},
      onUnexpectedClose: () => undefined
    })
    const event: HarnessCompactionEvent = {
      type: 'compaction',
      trigger: 'manual',
      summary: 'Greeted.',
      tokensBefore: 1200
    }
    const line = `${JSON.stringify({ type: 'turn.event', id: 'turn', event })}\n`
    onEvent?.({ event: 'Stdout', payload: Array.from(new TextEncoder().encode(line)) })
    expect((await process.messages.getReader().read()).value).toEqual({
      type: 'turn.event',
      id: 'turn',
      event
    })
  })

  test('routes the npm launcher through its cmd scope entry on Windows', async () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    try {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      })
      await mockTauriIPC((cmd, args) => {
        if (cmd === 'plugin:shell|spawn') {
          expect(args).toMatchObject({
            program: 'cmd-openpencil-harness',
            args: ['/c', 'openpencil-harness'],
            options: { encoding: 'raw', env: {} }
          })
          return 46
        }
        return null
      })
      const process = await spawnHarnessProcess({
        environment: {},
        onUnexpectedClose: () => undefined
      })
      await process.child.kill()
    } finally {
      if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
      else Reflect.deleteProperty(globalThis, 'navigator')
    }
  })
})
