import { describe, expect, test } from 'bun:test'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { expectDefined } from '@open-pencil/test-support/assert'

import { connectAgent, withinDeadline } from '@/app/ai/agents/acp/connection'
import { createDeferred } from '@/app/runtime/deferred'

import { fakeOneOffAgent } from '#tests/helpers/ai/fake-acp-agent'

const agent = expectDefined(
  ACP_AGENTS.find((candidate) => candidate.id === 'codex'),
  'Codex agent'
)

describe('a request with a deadline', () => {
  test('answers when the request does', async () => {
    expect(await withinDeadline(Promise.resolve('answer'), 1_000, 'late')).toBe('answer')
  })

  test('fails with the given reason once the deadline passes', async () => {
    await expect(withinDeadline(createDeferred<never>().promise, 10, 'late')).rejects.toThrow(
      'late'
    )
  })

  test('fails with whatever else ends first', async () => {
    const exited = Promise.reject(new Error('exited'))
    await expect(
      withinDeadline(createDeferred<never>().promise, 1_000, 'late', exited)
    ).rejects.toThrow('exited')
  })
})

describe('connecting to an agent', () => {
  test('starts it in the given folder and stops it on close', async () => {
    const fake = fakeOneOffAgent()
    const connection = await connectAgent(agent, { cwd: '/work', launch: fake.startup.launch })
    expect(fake.cwds).toEqual(['/work'])
    await connection.close()
    expect(fake.kills()).toBe(1)
  })

  test('a request the agent never answers ends at the deadline', async () => {
    const fake = fakeOneOffAgent()
    const connection = await connectAgent(agent, { launch: fake.startup.launch, timeoutMs: 10 })
    await expect(connection.bounded(createDeferred<never>().promise)).rejects.toThrow(agent.name)
    await connection.close()
  })

  test('a stop ends a request that only waits on the agent', async () => {
    const fake = fakeOneOffAgent()
    const stop = new AbortController()
    const connection = await connectAgent(agent, {
      launch: fake.startup.launch,
      signal: stop.signal,
      stopMessage: 'Stopped by the test.'
    })
    const waiting = connection.untilStopped(createDeferred<never>().promise)
    stop.abort()
    await expect(waiting).rejects.toThrow('Stopped by the test.')
    await connection.close()
  })

  test('tells its owner the process, so the owner can stop an agent that is still starting', async () => {
    const fake = fakeOneOffAgent()
    let kill: (() => Promise<void>) | null = null
    const connection = await connectAgent(agent, {
      launch: fake.startup.launch,
      onProcess: (child) => {
        kill = () => child.kill()
      }
    })
    await expectDefined<() => Promise<void>>(kill, 'the started process')()
    expect(fake.kills()).toBe(1)
    await connection.close()
  })
})
