import { describe, expect, test } from 'bun:test'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { expectDefined } from '@open-pencil/test-support/assert'

import { readAgentModels } from '@/app/ai/agents/acp/oneoff'

import { fakeOneOffAgent, MODEL_OPTIONS, WORKSPACE } from '#tests/helpers/ai/fake-acp-agent'

const agent = expectDefined(
  ACP_AGENTS.find((candidate) => candidate.id === 'claude-code'),
  'Claude agent'
)

describe('reading the models an agent offers', () => {
  test('lists them with whether the agent takes images, then stops the agent', async () => {
    const fake = fakeOneOffAgent({ configOptions: MODEL_OPTIONS, imageInput: true })
    const list = await readAgentModels(agent, { startup: fake.startup })
    expect(list).toEqual({
      imageInput: true,
      models: {
        current: 'default',
        options: [
          { id: 'default', name: 'Default' },
          { id: 'opus', name: 'Opus' }
        ]
      }
    })
    expect(fake.kills()).toBe(1)
  })

  test('starts the agent in its workspace, with no OpenPencil tools', async () => {
    const fake = fakeOneOffAgent()
    await readAgentModels(agent, { startup: fake.startup })
    expect(fake.cwds).toEqual([WORKSPACE])
    expect(fake.created).toEqual([{ cwd: WORKSPACE, mcpServers: [] }])
  })

  test('says so when the agent offers no choice or takes no images', async () => {
    const fake = fakeOneOffAgent({ imageInput: false })
    expect(await readAgentModels(agent, { startup: fake.startup })).toEqual({
      models: null,
      imageInput: false
    })
  })

  test.each(['initialize', 'newSession'] as const)(
    'fails instead of waiting when the agent exits at %s',
    async (on) => {
      const fake = fakeOneOffAgent({ stalls: { on, as: 'exits' } })
      await expect(readAgentModels(agent, { startup: fake.startup })).rejects.toThrow(agent.name)
      expect(fake.kills()).toBe(1)
    }
  )

  test('fails, and stops the agent, when it does not answer in time', async () => {
    const fake = fakeOneOffAgent({ stalls: { on: 'newSession', as: 'hangs' } })
    await expect(
      readAgentModels(agent, { startup: fake.startup, startTimeoutMs: 20 })
    ).rejects.toThrow('did not answer')
    expect(fake.kills()).toBe(1)
  })

  test('stopping while the agent starts stops the agent', async () => {
    const fake = fakeOneOffAgent({ stalls: { on: 'newSession', as: 'hangs' } })
    const stop = new AbortController()
    const reading = readAgentModels(agent, { startup: fake.startup, signal: stop.signal })
    await fake.sessionRequested
    stop.abort()
    await expect(reading).rejects.toThrow('stopped')
    expect(fake.kills()).toBe(1)
  })

  test('launches no agent when stopped before it starts', async () => {
    const fake = fakeOneOffAgent()
    const stop = new AbortController()
    stop.abort()
    await expect(
      readAgentModels(agent, { startup: fake.startup, signal: stop.signal })
    ).rejects.toThrow('stopped')
    expect(fake.spawns()).toBe(0)
  })
})
