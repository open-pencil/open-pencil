import { expect, it } from 'bun:test'

import { convertReadableStreamToArray } from 'ai/test'

import { createRenderStreamModel } from '#tests/helpers/chat/render-stream/model'

const scenario = {
  jsx: '<Text>Quotes " backslash \\ newline\n 😀 checkpoint</Text>',
  placement: { x: 80, y: 100 },
  pauseAfter: ['checkpoint', '</Text>']
}

it('uses SDK mocks and serializes complete arguments without JSON fragment construction', async () => {
  const fixture = createRenderStreamModel(scenario)
  try {
    expect(fixture.ready()).toBe(false)
    const response = await fixture.model.doStream({ prompt: [] })
    expect(fixture.ready()).toBe(true)
    const reader = response.stream.getReader()
    expect((await reader.read()).value?.type).toBe('stream-start')
    expect((await reader.read()).value?.type).toBe('tool-input-start')
    const pending = reader.read()
    fixture.advance()
    const first = (await pending).value
    expect(first?.type).toBe('tool-input-delta')
    if (first?.type !== 'tool-input-delta') throw new Error('Expected argument delta')
    expect(first.delta.endsWith('checkpoint')).toBe(true)
    reader.releaseLock()
    fixture.complete()
    const remaining = await convertReadableStreamToArray(response.stream)
    const serialized =
      first.delta +
      remaining
        .filter((part) => part.type === 'tool-input-delta')
        .map((part) => part.delta)
        .join('')
    expect(JSON.parse(serialized)).toEqual({ ...scenario.placement, jsx: scenario.jsx })
    const call = remaining.find((part) => part.type === 'tool-call')
    expect(call?.input).toBe(serialized)
    const next = await fixture.model.doStream({ prompt: [] })
    expect(await convertReadableStreamToArray(next.stream)).toContainEqual({
      type: 'text-delta',
      id: 'done',
      delta: 'Rendered.'
    })
    expect(fixture.model.doStreamCalls).toHaveLength(2)
  } finally {
    fixture.dispose()
  }
})

it('aborts a paused stream without releasing its tool call', async () => {
  const fixture = createRenderStreamModel(scenario)
  const abort = new AbortController()
  try {
    const response = await fixture.model.doStream({ prompt: [], abortSignal: abort.signal })
    abort.abort()
    const chunks = await convertReadableStreamToArray(response.stream)
    expect(chunks.some((part) => part.type === 'tool-call')).toBe(false)
  } finally {
    fixture.dispose()
  }
})

it('can fail a paused stream without depending on elapsed time', async () => {
  const fixture = createRenderStreamModel(scenario)
  try {
    const response = await fixture.model.doStream({ prompt: [] })
    fixture.fail()
    await expect(convertReadableStreamToArray(response.stream)).rejects.toThrow(
      'Provider disconnected'
    )
  } finally {
    fixture.dispose()
  }
})

it('rejects checkpoints that do not exist in the serialized scenario', () => {
  expect(() => createRenderStreamModel({ ...scenario, pauseAfter: ['not present'] })).toThrow(
    'checkpoint not found'
  )
})
