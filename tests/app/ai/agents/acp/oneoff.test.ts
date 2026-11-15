import { describe, expect, test } from 'bun:test'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { expectDefined } from '@open-pencil/test-support/assert'

import { AgentImageInputError, askAgent, readAgentOffer } from '@/app/ai/agents/acp/oneoff'
import { AgentModelChoiceError } from '@/app/ai/agents/acp/session'

import { fakeOneOffAgent, MODEL_OPTIONS, WORKSPACE } from '#tests/helpers/ai/fake-acp-agent'

const agent = expectDefined(
  ACP_AGENTS.find((candidate) => candidate.id === 'claude-code'),
  'Claude agent'
)

const images = [
  { mediaType: 'image/png', data: new Uint8Array([1, 2, 3]) },
  { mediaType: 'image/jpeg', data: new Uint8Array([4, 5, 6]) }
]

describe('reading what an agent offers', () => {
  test('lists its models with whether it takes images, then stops the agent', async () => {
    const fake = fakeOneOffAgent({ configOptions: MODEL_OPTIONS, imageInput: true })
    expect(await readAgentOffer(agent, fake.startup)).toEqual({
      imageInput: true,
      models: [
        { id: 'default', name: 'Default' },
        { id: 'opus', name: 'Opus' }
      ]
    })
    expect(fake.kills()).toBe(1)
  })

  test('starts the agent in its workspace, with no OpenPencil tools', async () => {
    const fake = fakeOneOffAgent()
    await readAgentOffer(agent, fake.startup)
    expect(fake.cwds).toEqual([WORKSPACE])
    expect(fake.created).toEqual([{ cwd: WORKSPACE, mcpServers: [] }])
  })

  test('asks an agent that answers session options, and opens no session', async () => {
    const fake = fakeOneOffAgent({ configOptions: MODEL_OPTIONS, answersOptions: true })
    const offer = await readAgentOffer(agent, fake.startup)
    expect(offer.models.map((model) => model.id)).toEqual(['default', 'opus'])
    expect(fake.optionsRead).toEqual([{ cwd: WORKSPACE }])
    expect(fake.created).toEqual([])
  })

  test('says so when the agent offers no choice or takes no images', async () => {
    const fake = fakeOneOffAgent({ imageInput: false })
    expect(await readAgentOffer(agent, fake.startup)).toEqual({ models: [], imageInput: false })
  })

  test.each(['initialize', 'newSession'] as const)(
    'fails instead of waiting when the agent exits at %s',
    async (on) => {
      const fake = fakeOneOffAgent({ stalls: { on, as: 'exits' } })
      await expect(readAgentOffer(agent, fake.startup)).rejects.toThrow()
      expect(fake.kills()).toBe(1)
    }
  )

  test('fails, and stops the agent, when it does not answer in time', async () => {
    const fake = fakeOneOffAgent({ stalls: { on: 'newSession', as: 'hangs' } })
    await expect(readAgentOffer(agent, { ...fake.startup, timeoutMs: 20 })).rejects.toThrow(
      agent.name
    )
    expect(fake.kills()).toBe(1)
  })

  test('stopping while the agent starts stops the agent', async () => {
    const fake = fakeOneOffAgent({ stalls: { on: 'newSession', as: 'hangs' } })
    const stop = new AbortController()
    const reading = readAgentOffer(agent, { ...fake.startup, signal: stop.signal })
    await fake.sessionRequested
    stop.abort()
    await expect(reading).rejects.toThrow()
    expect(fake.kills()).toBe(1)
  })

  test('launches no agent when stopped before it starts', async () => {
    const fake = fakeOneOffAgent()
    const stop = new AbortController()
    stop.abort()
    await expect(readAgentOffer(agent, { ...fake.startup, signal: stop.signal })).rejects.toThrow()
    expect(fake.spawns()).toBe(0)
  })
})

describe('asking an agent one question', () => {
  test('sends each image as an image block before the text and returns what the agent said', async () => {
    const fake = fakeOneOffAgent({ answer: ['Red square, ', 'centered.'] })
    const said = await askAgent(agent, { text: 'Describe the layout', images, ...fake.startup })
    expect(said).toBe('Red square, centered.')
    expect(fake.prompts).toEqual([
      [
        { type: 'image', data: 'AQID', mimeType: 'image/png' },
        { type: 'image', data: 'BAUG', mimeType: 'image/jpeg' },
        { type: 'text', text: 'Describe the layout' }
      ]
    ])
    expect(fake.created).toEqual([{ cwd: WORKSPACE, mcpServers: [] }])
  })

  test('stops the agent after it answered', async () => {
    const fake = fakeOneOffAgent({ answer: ['Done.'] })
    await askAgent(agent, { text: 'Look', ...fake.startup })
    expect(fake.kills()).toBe(1)
  })

  test('puts the session on the model the profile names', async () => {
    const fake = fakeOneOffAgent({ answer: ['Done.'], configOptions: MODEL_OPTIONS })
    await askAgent(agent, { text: 'Look', model: 'opus', ...fake.startup })
    expect(fake.configured).toEqual([{ sessionId: 'session-1', configId: 'model', value: 'opus' }])
  })

  test('refuses a model when the agent offers no choice, and sends no prompt', async () => {
    const fake = fakeOneOffAgent({ answer: ['Done.'] })
    await expect(
      askAgent(agent, { text: 'Look', model: 'opus', ...fake.startup })
    ).rejects.toBeInstanceOf(AgentModelChoiceError)
    expect(fake.prompts).toEqual([])
    expect(fake.kills()).toBe(1)
  })

  test('fails, and stops the agent, when the agent answers nothing', async () => {
    const fake = fakeOneOffAgent({ answer: ['  '] })
    await expect(askAgent(agent, { text: 'Look', ...fake.startup })).rejects.toThrow(agent.name)
    expect(fake.kills()).toBe(1)
  })

  test.each(['exits', 'hangs'] as const)(
    'fails, and stops the agent, when it %s instead of answering',
    async (as) => {
      const fake = fakeOneOffAgent({ stalls: { on: 'prompt', as } })
      await expect(
        askAgent(agent, { text: 'Look', ...fake.startup, timeoutMs: 50 })
      ).rejects.toThrow()
      expect(fake.kills()).toBe(1)
    }
  )

  test('stopping while the agent answers stops the agent', async () => {
    const fake = fakeOneOffAgent({ stalls: { on: 'prompt', as: 'hangs' } })
    const stop = new AbortController()
    const asking = askAgent(agent, { text: 'Look', ...fake.startup, signal: stop.signal })
    await fake.promptRequested
    stop.abort()
    await expect(asking).rejects.toThrow()
    expect(fake.prompts).toHaveLength(1)
    expect(fake.kills()).toBe(1)
  })

  test('sends no images to an agent that takes none', async () => {
    const fake = fakeOneOffAgent({ imageInput: false, answer: ['Done.'] })
    await expect(askAgent(agent, { text: 'Look', images, ...fake.startup })).rejects.toBeInstanceOf(
      AgentImageInputError
    )
    expect(fake.created).toEqual([])
    expect(fake.prompts).toEqual([])
    expect(fake.kills()).toBe(1)
  })
})
