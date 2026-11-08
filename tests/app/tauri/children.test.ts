import { afterEach, expect, test } from 'bun:test'

import { Command } from '@tauri-apps/plugin-shell'
import { ref } from 'vue'

import { createAgentChildren } from '@/app/tauri/children'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(clearTauriMocks)

type ShellEvent = { event: string; payload: unknown }

/** A plugin-shell that hands out pids in order and records the pids it was asked to kill. */
async function shell() {
  const killed: number[] = []
  const events = new Map<number, (event: ShellEvent) => void>()
  let nextPid = 100
  await mockTauriIPC((cmd, args) => {
    if (cmd === 'plugin:shell|spawn') {
      const pid = nextPid++
      const { onEvent } = args as { onEvent: { onmessage: (event: ShellEvent) => void } }
      events.set(pid, (event) => onEvent.onmessage(event))
      return pid
    }
    if (cmd === 'plugin:shell|kill') killed.push((args as { pid: number }).pid)
    return null
  })
  return {
    killed,
    exit(pid: number) {
      events.get(pid)?.({ event: 'Terminated', payload: { code: 0, signal: null } })
    }
  }
}

test('a reloaded page stops the agents the previous page left running, once', async () => {
  const fake = await shell()
  const storage = ref<unknown>(null)

  const before = createAgentChildren(storage)
  const kept = await before.spawn(Command.create('agent'))
  const exited = await before.spawn(Command.create('agent'))
  fake.exit(exited.pid)
  expect(fake.killed).toEqual([])

  const after = createAgentChildren(storage)
  const fresh = await after.spawn(Command.create('agent'))
  await after.stopLeftovers()
  expect(fake.killed).toEqual([kept.pid])

  const next = createAgentChildren(storage)
  await next.stopLeftovers()
  expect(fake.killed).toEqual([kept.pid, fresh.pid])
})

test('unreadable storage stops nothing', async () => {
  const fake = await shell()
  const children = createAgentChildren(ref<unknown>({ pids: 'not a list' }))
  await children.stopLeftovers()
  expect(fake.killed).toEqual([])
})
