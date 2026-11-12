import { describe, expect, test } from 'bun:test'

import { generateText } from 'ai'
import * as v from 'valibot'

import { chatGPTAdapter } from '@/app/ai/providers/chatgpt/adapter'
import { serializeChatGPTCredential } from '@/app/ai/providers/chatgpt/credential'

import { credential } from '#tests/helpers/ai/chatgpt'

const completed = (text: string) =>
  `data: ${JSON.stringify({
    type: 'response.completed',
    response: {
      id: 'resp_1',
      created_at: 0,
      model: 'gpt-6-luna',
      output: [
        { type: 'reasoning', id: 'rs_1', encrypted_content: 'sealed-1', summary: [] },
        {
          type: 'message',
          id: 'msg_1',
          role: 'assistant',
          content: [{ type: 'output_text', text, annotations: [] }]
        }
      ],
      usage: { input_tokens: 1, output_tokens: 1 }
    }
  })}\n\n`

const bodySchema = v.looseObject({ input: v.array(v.looseObject({})) })

describe('ChatGPT adapter', () => {
  test('sends an earlier reply and its sealed reasoning whole, since the backend keeps no items', async () => {
    const inputs: unknown[][] = []
    const key = serializeChatGPTCredential(credential())
    const model = chatGPTAdapter.create(
      {
        providerID: 'chatgpt',
        apiKey: key,
        modelID: 'gpt-6-luna',
        customModelID: '',
        customBaseURL: '',
        customAPIType: 'responses'
      },
      {
        fetch: async (_input, init) => {
          const body = v.parse(
            v.pipe(v.string(), v.parseJson(), bodySchema),
            typeof init?.body === 'string' ? init.body : ''
          )
          inputs.push(body.input)
          return new Response(completed('Hi'), {
            headers: { 'content-type': 'text/event-stream' }
          })
        }
      }
    )

    const first = await generateText({ model, prompt: 'hi' })
    await generateText({
      model,
      messages: [
        { role: 'user', content: 'hi' },
        ...first.response.messages,
        { role: 'user', content: 'bye' }
      ]
    })

    expect(inputs[1]).toContainEqual(expect.objectContaining({ role: 'assistant' }))
    expect(inputs[1]).toContainEqual(
      expect.objectContaining({ type: 'reasoning', encrypted_content: 'sealed-1' })
    )
    expect(inputs[1]).not.toContainEqual(expect.objectContaining({ type: 'item_reference' }))
  })
})
