import { expect, test } from 'bun:test'

import type { HarnessSidecarMessage } from '@open-pencil/harness'

import { HarnessChatTransport } from '@/app/ai/harness/transport'

test('failed session stop kills the process without deleting resume state', async () => {
  let output: ReadableStreamDefaultController<HarnessSidecarMessage> | undefined
  const methods: string[] = []
  let kills = 0
  const transport = new HarnessChatTransport(
    'test-session',
    {
      adapter: 'pi',
      sandbox: 'just-bash',
      model: 'test',
      settings: {},
      instructions: '',
      mcpServers: {}
    },
    {},
    async () => ({
      child: {
        write: async () => undefined,
        kill: async () => {
          kills++
          output?.close()
        }
      },
      messages: new ReadableStream({
        start(controller) {
          output = controller
        }
      }),
      send: async (request) => {
        if (
          !('id' in request) ||
          !('method' in request) ||
          typeof request.id !== 'string' ||
          typeof request.method !== 'string'
        )
          throw new Error('Invalid request')
        methods.push(request.method)
        output?.enqueue({
          type: 'response',
          id: request.id,
          ...(request.method === 'session.stop'
            ? { error: 'Resume storage failed' }
            : { result: {} })
        })
      }
    })
  )
  const stream = await transport.sendMessages({
    chatId: 'test',
    trigger: 'submit-message',
    messageId: undefined,
    messages: [{ id: 'user', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
    abortSignal: undefined
  })
  const reader = stream.getReader()
  while (!(await reader.read()).done) {
    /* Drain the completed turn. */
  }
  await expect(transport.stop()).rejects.toThrow('Resume storage failed')
  expect(kills).toBe(1)
  expect(methods).toContain('session.stop')
  expect(methods).not.toContain('session.destroy')
  await transport.stop()
  expect(kills).toBe(1)
})
