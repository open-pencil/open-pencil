import { expect, test } from 'bun:test'

import type { UIMessage } from 'ai'
import { reactive, toRaw } from 'vue'

import { wasStopped } from '@/app/ai/chat/metadata'
import { settleMessage } from '@/app/ai/reply/settle'

function reply(parts: UIMessage['parts'], metadata?: unknown): UIMessage {
  return { id: 'reply', role: 'assistant', parts, metadata }
}

const call = (toolCallId: string, state: 'input-streaming' | 'input-available') =>
  state === 'input-streaming'
    ? ({ type: 'tool-create_shape', toolCallId, state, input: undefined } as const)
    : ({ type: 'tool-create_shape', toolCallId, state, input: { type: 'RECTANGLE' } } as const)

test('a stopped reply no longer reads as running, and says which calls changed the document', () => {
  const settled = settleMessage(
    reply([
      { type: 'reasoning', text: 'Planning', state: 'streaming' },
      { type: 'text', text: 'Drawing', state: 'streaming' },
      call('landed', 'input-available'),
      call('waiting', 'input-streaming')
    ]),
    { stopped: true, changed: (toolCallId) => toolCallId === 'landed' }
  )

  expect(settled.parts).toMatchObject([
    { type: 'reasoning', state: 'done' },
    { type: 'text', state: 'done' },
    {
      toolCallId: 'landed',
      state: 'output-error',
      errorText: expect.stringContaining('It changed the document')
    },
    {
      toolCallId: 'waiting',
      state: 'output-error',
      errorText: expect.stringContaining('did not change the document')
    }
  ])
  expect(wasStopped(settled)).toBe(true)
})

test('a failed reply settles its parts without being marked stopped, keeping its metadata', () => {
  const settled = settleMessage(
    reply([{ type: 'reasoning', text: 'Planning', state: 'streaming' }], { reverted: true }),
    { stopped: false }
  )
  expect(settled.parts).toMatchObject([{ state: 'done' }])
  expect(settled.metadata).toEqual({ reverted: true })
  expect(wasStopped(settled)).toBe(false)
})

test('a reopened reply saved mid-call does not claim what the call did', () => {
  const [part] = settleMessage(reply([call('saved', 'input-available')]), { stopped: false }).parts
  expect(part).toMatchObject({
    state: 'output-error',
    errorText: expect.stringContaining('reported back')
  })
})

test('a finished reply is left as it is', () => {
  const finished = reply([
    { type: 'text', text: 'Done', state: 'done' },
    {
      type: 'tool-create_shape',
      toolCallId: 'done',
      state: 'output-available',
      input: { type: 'RECTANGLE' },
      output: { id: '0:1' }
    }
  ])
  expect(settleMessage(finished, { stopped: false })).toBe(finished)
})

test("a reply settled from the chat's reactive state can still be saved", () => {
  const chat = reactive({
    messages: [
      reply([
        { type: 'reasoning', text: 'Planning', state: 'streaming' },
        call('c', 'input-available')
      ])
    ]
  })
  const [message] = chat.messages
  if (!message) throw new Error('No message')
  const settled = settleMessage(message, { stopped: true, changed: () => false })
  // Conversations are saved with `structuredClone`, which cannot copy Vue's proxies.
  expect(() => structuredClone(toRaw(settled))).not.toThrow()
})
