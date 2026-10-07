import 'fake-indexeddb/auto'
import { expect, spyOn, test } from 'bun:test'

import { simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { toRaw } from 'vue'

import { FigmaAPI } from '@open-pencil/core/figma-api'

import { createToolLoopTransport } from '@/app/ai/chat/transports'
import { endRun, markRunPreview, runPageId, startRun } from '@/app/ai/tools'
import { aiToolOverrides } from '@/app/ai/tools/preferences'
import { markRunWork } from '@/app/ai/tools/run'
import * as figmaFactory from '@/app/automation/bridge/figma-factory'
import { createEditorStore } from '@/app/editor/session/create'
import { presenceOf } from '@/app/presence/registry'
import { appPreferences } from '@/app/settings/preferences/store'

import { expectDefined } from '#tests/helpers/assert'
import { MOCK_USAGE } from '#tests/helpers/chat/usage'

type EditorStore = ReturnType<typeof createEditorStore>
type StreamChunk =
  Awaited<ReturnType<MockLanguageModelV4['doStream']>>['stream'] extends ReadableStream<infer Chunk>
    ? Chunk
    : never
type Step = { toolName: string; input: unknown } | ((store: EditorStore) => Promise<void>)

/** Run one message whose model calls `steps` in order: a tool call, or a user action first. */
async function runMessage(store: EditorStore, steps: Step[]) {
  let call = 0
  const model = new MockLanguageModelV4({
    doStream: async () => {
      let step = steps[call++]
      while (typeof step === 'function') {
        await step(store)
        step = steps[call++]
      }
      const chunks = step
        ? [
            {
              type: 'tool-call' as const,
              toolCallId: `call-${call}`,
              toolName: step.toolName,
              input: JSON.stringify(step.input)
            },
            {
              type: 'finish' as const,
              finishReason: { unified: 'tool-calls' as const, raw: undefined },
              usage: MOCK_USAGE
            }
          ]
        : [
            {
              type: 'finish' as const,
              finishReason: { unified: 'stop' as const, raw: undefined },
              usage: MOCK_USAGE
            }
          ]
      return {
        stream: simulateReadableStream<StreamChunk>({
          initialDelayInMs: null,
          chunkDelayInMs: null,
          chunks
        })
      }
    }
  })
  const transport = createToolLoopTransport({
    store,
    providerID: 'openai',
    model,
    effectiveModelID: 'test',
    maxOutputTokens: 100,
    thinkingLevel: () => 'default'
  })
  const stream = await transport.sendMessages({
    trigger: 'submit-message',
    chatId: 'run-page',
    messageId: undefined,
    abortSignal: undefined,
    messages: [{ id: 'user', role: 'user', parts: [{ type: 'text', text: 'Draw' }] }]
  })
  const reader = stream.getReader()
  try {
    while (!(await reader.read()).done);
  } finally {
    reader.releaseLock()
  }
}

async function withStore(
  check: (store: EditorStore, pages: { a: string; b: string }) => Promise<void>
) {
  const previousPreferences = structuredClone(toRaw(appPreferences.value))
  const previousTools = aiToolOverrides.value
  const store = createEditorStore()
  // Viewport DOM plumbing is outside this contract; keep the page the tools are given.
  const factory = spyOn(figmaFactory, 'makeFigmaFromStore').mockImplementation((editor, pageId) => {
    const api = new FigmaAPI(editor.graph)
    api.currentPage = api.wrapNode(pageId ?? editor.state.currentPageId)
    return api
  })
  // No canvas presents frames here; treat every page switch as presented.
  store.preparationController.acknowledgePresentation(Number.MAX_SAFE_INTEGER)
  try {
    aiToolOverrides.value = { create_shape: true, switch_page: true }
    const a = store.state.currentPageId
    const b = store.graph.addPage('B').id
    await check(store, { a, b })
  } finally {
    appPreferences.value = previousPreferences
    aiToolOverrides.value = previousTools
    factory.mockRestore()
    store.dispose()
  }
}

const rectangle = {
  toolName: 'create_shape',
  input: { type: 'RECTANGLE', x: 0, y: 0, width: 10, height: 10 }
}

test('a run keeps working on its page while the user views another', async () => {
  await withStore(async (store, { a, b }) => {
    await runMessage(store, [(editor) => editor.switchPage(b), rectangle])

    expect(store.state.currentPageId).toBe(b)
    expect(runPageId(store)).toBe(a)
    expect(store.graph.getChildren(a)).toHaveLength(1)
    expect(store.graph.getChildren(b)).toHaveLength(0)

    // Undo restores the page the tool changed, not the page on screen.
    store.undo.undo()
    expect(store.graph.getChildren(a)).toHaveLength(0)
    expect(store.state.currentPageId).toBe(b)
  })
})

test("the agent's switch_page moves the run and the user's view", async () => {
  await withStore(async (store, { b }) => {
    await runMessage(store, [{ toolName: 'switch_page', input: { page: b } }, rectangle])

    expect(runPageId(store)).toBe(b)
    expect(store.graph.getChildren(b)).toHaveLength(1)
    expect(presenceOf(store).agents.value[0]?.pageId).toBe(b)
    expect(store.state.currentPageId).toBe(b)
  })
})

test('a run falls back to the page on screen when its page is deleted', async () => {
  await withStore(async (store, { a, b }) => {
    await runMessage(store, [])
    expect(runPageId(store)).toBe(a)
    await store.switchPage(b)
    store.graph.deleteNode(a)
    expect(runPageId(store)).toBe(b)
  })
})

test("shows the chat's agent where its tools work, then takes it off the canvas", async () => {
  await withStore(async (store, { a }) => {
    let during: ReturnType<typeof presenceOf>['agents']['value'] = []
    await runMessage(store, [
      rectangle,
      async (editor) => {
        during = presenceOf(editor).agents.value
      }
    ])
    const [shape] = store.graph.getChildren(a)
    expect(during).toMatchObject([
      { kind: 'chat', status: 'editing', cursor: { x: shape?.x, y: shape?.y, pageId: a } }
    ])
    expect(presenceOf(store).agents.value).toMatchObject([
      { name: during[0]?.name, status: 'idle', cursor: undefined }
    ])
  })
})

test('the agent moves through streamed JSX, then onto the layers the tool made', () => {
  const store = createEditorStore()
  try {
    startRun(store, 10)
    markRunPreview(store, {
      cursor: { x: 40, y: 60 },
      outline: [{ x: 40, y: 60, width: 100, height: 20 }]
    })
    const agent = () => expectDefined(presenceOf(store).agents.value[0], 'agent')
    expect(agent()).toMatchObject({
      status: 'editing',
      cursor: { x: 40, y: 60, pageId: store.state.currentPageId },
      outline: [{ x: 40, y: 60, width: 100, height: 20 }]
    })

    const made = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
      x: 10,
      y: 20,
      width: 30,
      height: 30
    })
    markRunWork(store, [made.id])
    expect(agent()).toMatchObject({ selection: [made.id], outline: undefined })
    endRun(store)
    expect(agent()).toMatchObject({ status: 'idle', outline: undefined })
  } finally {
    store.preparationController.dispose()
  }
})
