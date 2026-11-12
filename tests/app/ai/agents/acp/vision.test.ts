import { describe, expect, test } from 'bun:test'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { expectDefined } from '@open-pencil/test-support/assert'

import { analyzeImagesWithAgent } from '@/app/ai/agents/acp/vision'

import { fakeOneOffAgent, MODEL_OPTIONS } from '#tests/helpers/ai/fake-acp-agent'

const agent = expectDefined(
  ACP_AGENTS.find((candidate) => candidate.id === 'claude-code'),
  'Claude agent'
)

const images = [
  { mediaType: 'image/png' as const, data: new Uint8Array([1, 2, 3]) },
  { mediaType: 'image/jpeg' as const, data: new Uint8Array([4, 5, 6]) }
]

describe('analyzing images with a coding agent', () => {
  test('sends each image as an image block before the instruction and returns what the agent said', async () => {
    const fake = fakeOneOffAgent({ answer: ['Red square, ', 'centered.'] })
    const text = await analyzeImagesWithAgent(agent, {
      instruction: 'Describe the layout',
      images,
      startup: fake.startup
    })
    expect(text).toBe('Red square, centered.')
    expect(fake.prompts).toEqual([
      [
        { type: 'image', data: 'AQID', mimeType: 'image/png' },
        { type: 'image', data: 'BAUG', mimeType: 'image/jpeg' },
        { type: 'text', text: 'Describe the layout' }
      ]
    ])
  })

  test('stops the agent after it answered', async () => {
    const fake = fakeOneOffAgent({ answer: ['Done.'] })
    await analyzeImagesWithAgent(agent, { instruction: 'Look', images, startup: fake.startup })
    expect(fake.kills()).toBe(1)
  })

  test('applies the model the profile names', async () => {
    const fake = fakeOneOffAgent({
      answer: ['Done.'],
      configOptions: MODEL_OPTIONS
    })
    await analyzeImagesWithAgent(agent, {
      instruction: 'Look',
      images,
      model: 'opus',
      startup: fake.startup
    })
    expect(fake.configured.map((request) => request.value)).toEqual(['opus'])
  })

  test('fails, and stops the agent, when the agent answers nothing', async () => {
    const fake = fakeOneOffAgent({ answer: ['  '] })
    await expect(
      analyzeImagesWithAgent(agent, { instruction: 'Look', images, startup: fake.startup })
    ).rejects.toThrow('returned no description')
    expect(fake.kills()).toBe(1)
  })

  test('fails instead of waiting when the agent exits while answering', async () => {
    const fake = fakeOneOffAgent({ stalls: { on: 'prompt', as: 'exits' } })
    await expect(
      analyzeImagesWithAgent(agent, { instruction: 'Look', images, startup: fake.startup })
    ).rejects.toThrow(agent.name)
    expect(fake.kills()).toBe(1)
  })

  test('stopping while the agent answers stops the agent', async () => {
    const fake = fakeOneOffAgent({ stalls: { on: 'prompt', as: 'hangs' } })
    const stop = new AbortController()
    const analysis = analyzeImagesWithAgent(agent, {
      instruction: 'Look',
      images,
      signal: stop.signal,
      startup: fake.startup
    })
    await fake.sessionRequested
    await Bun.sleep(0)
    stop.abort()
    await expect(analysis).rejects.toThrow('stopped')
    expect(fake.kills()).toBe(1)
  })

  test('fails clearly, without sending the images, when the agent takes no images', async () => {
    const fake = fakeOneOffAgent({ imageInput: false, answer: ['Never sent.'] })
    await expect(
      analyzeImagesWithAgent(agent, { instruction: 'Look', images, startup: fake.startup })
    ).rejects.toThrow(`${agent.name} does not accept images.`)
    expect(fake.prompts).toEqual([])
    expect(fake.kills()).toBe(1)
  })
})
