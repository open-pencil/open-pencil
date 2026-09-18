import 'fake-indexeddb/auto'
import { expect, spyOn, test } from 'bun:test'

import { simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { toRaw } from 'vue'

import { FigmaAPI } from '@open-pencil/core/figma-api'

import { maxAgentSteps, reasoningDisplay } from '@/app/ai/chat/preferences'
import { DEFAULT_AGENT_STEPS, resolveAgentStepLimit } from '@/app/ai/chat/step-limit'
import { createToolLoopTransport } from '@/app/ai/chat/transports'
import { didHitStepLimit } from '@/app/ai/tools'
import { aiToolOverrides } from '@/app/ai/tools/preferences'
import * as figmaFactory from '@/app/automation/bridge/figma-factory'
import { createEditorStore } from '@/app/editor/session/create'
import { appPreferences } from '@/app/settings/preferences/store'

test.each([undefined, null, '100', 0, -1, 1.5, 1001, Number.NaN, Infinity])(
  'invalid stored step limit %p falls back to the default',
  (value) => {
    expect(resolveAgentStepLimit(value)).toBe(DEFAULT_AGENT_STEPS)
  }
)

test('step limit and reasoning updates preserve each other', () => {
  const previous = structuredClone(toRaw(appPreferences.value))
  try {
    maxAgentSteps.value = 200
    reasoningDisplay.value = 'expanded'
    expect(maxAgentSteps.value).toBe(200)
    maxAgentSteps.value = 1
    expect(reasoningDisplay.value).toBe('expanded')
    expect(maxAgentSteps.value).toBe(1)
    maxAgentSteps.value = 1000
    expect(maxAgentSteps.value).toBe(1000)
  } finally {
    appPreferences.value = previous
  }
})

test('stop condition, warnings and limit detection share the budget captured per message', async () => {
  const previousPreferences = structuredClone(toRaw(appPreferences.value))
  const previousTools = aiToolOverrides.value
  const store = createEditorStore()
  // Viewport DOM plumbing is outside this transport/budget contract.
  const factory = spyOn(figmaFactory, 'makeFigmaFromStore').mockImplementation(
    (editor) => new FigmaAPI(editor.graph)
  )
  let calls = 0
  const model = new MockLanguageModelV4({
    doStream: async () => {
      calls++
      // Changing Settings while streaming must only affect the next message.
      maxAgentSteps.value = 1
      return {
        stream: simulateReadableStream({
          initialDelayInMs: null,
          chunkDelayInMs: null,
          chunks: [
            {
              type: 'tool-call',
              toolCallId: `call-${calls}`,
              toolName: 'get_selection',
              input: '{}'
            },
            {
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: undefined },
              usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 1, text: 1, reasoning: undefined }
              }
            }
          ]
        })
      }
    }
  })
  try {
    maxAgentSteps.value = 2
    aiToolOverrides.value = {}
    const transport = createToolLoopTransport({
      store,
      providerID: 'openai',
      model,
      effectiveModelID: 'test',
      maxOutputTokens: 100,
      reasoningEffort: ''
    })
    async function send() {
      const stream = await transport.sendMessages({
        trigger: 'submit-message',
        chatId: 'step-limit',
        messageId: undefined,
        messages: [{ id: 'user', role: 'user', parts: [{ type: 'text', text: 'Inspect' }] }]
      })
      const reader = stream.getReader()
      try {
        while (true) {
          const next = await reader.read()
          if (next.done) break
          expect(next.value.type).not.toBe('error')
        }
      } finally {
        reader.releaseLock()
      }
    }
    await send()
    expect(calls).toBe(2)
    expect(
      JSON.stringify(model.doStreamCalls[1]?.prompt.filter((message) => message.role === 'tool'))
    ).toContain('out of 2')
    expect(didHitStepLimit(store)).toBe(true)
    maxAgentSteps.value = 100
    expect(didHitStepLimit(store)).toBe(true)
    maxAgentSteps.value = 1
    await send()
    expect(calls).toBe(3)
    expect(didHitStepLimit(store)).toBe(true)
  } finally {
    appPreferences.value = previousPreferences
    aiToolOverrides.value = previousTools
    factory.mockRestore()
    store.dispose()
  }
})
