import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import type { ToolExecutionOptions, UIMessage } from 'ai'
import { shallowRef, toRaw } from 'vue'

import { FigmaAPI } from '@open-pencil/core/figma-api'

import { changePreviewSize } from '@/app/ai/chat/preferences'
import { useChatSubmission, type ChatInstance } from '@/app/ai/chat/submission/use'
import { clearTurns, revertTurn, turnEdits } from '@/app/ai/chat/turns'
import { createAITools, startRun } from '@/app/ai/tools'
import * as figmaFactory from '@/app/automation/bridge/figma-factory'
import { createEditorStore } from '@/app/editor/session/create'
import { appPreferences } from '@/app/settings/preferences/store'

type EditorStore = ReturnType<typeof createEditorStore>

let store: EditorStore
let previousPreferences: typeof appPreferences.value
let factory: ReturnType<typeof spyOn>

beforeEach(() => {
  previousPreferences = structuredClone(toRaw(appPreferences.value))
  changePreviewSize.value = 'off'
  store = createEditorStore()
  factory = spyOn(figmaFactory, 'makeFigmaFromStore').mockImplementation((editor, pageId) => {
    const api = new FigmaAPI(editor.graph)
    api.currentPage = api.wrapNode(pageId ?? editor.state.currentPageId)
    return api
  })
})

afterEach(() => {
  appPreferences.value = previousPreferences
  factory.mockRestore()
  clearTurns()
  store.dispose()
})

function call(toolCallId: string): ToolExecutionOptions<unknown> {
  return { toolCallId, messages: [], context: undefined }
}

/** A chat whose every send is one agent run that resizes `nodeId` to the next width. */
function fakeChat(nodeId: string) {
  const tools = createAITools(store)
  const widths = [200, 300, 400]
  let replies = 0
  const chat = {
    status: 'ready' as const,
    messages: [] as UIMessage[],
    async reply() {
      startRun(store, 10)
      const width = widths[replies] ?? 500
      replies++
      await tools.node_resize.execute?.({ id: nodeId, width, height: 60 }, call(`call-${replies}`))
      chat.messages = [
        ...chat.messages,
        { id: `reply-${replies}`, role: 'assistant', parts: [{ type: 'text', text: 'Done' }] }
      ]
    },
    async sendMessage(message: { text: string; messageId?: string }) {
      const index = chat.messages.findIndex((candidate) => candidate.id === message.messageId)
      const kept = index === -1 ? chat.messages : chat.messages.slice(0, index)
      chat.messages = [
        ...kept,
        { id: message.messageId ?? `request-${replies}`, role: 'user', parts: [] }
      ]
      await chat.reply()
    },
    async regenerate() {
      chat.messages = chat.messages.slice(0, -1)
      await chat.reply()
    },
    stop: async () => undefined
  }
  return chat
}

function submission(chat: ReturnType<typeof fakeChat>) {
  return useChatSubmission({
    chat: shallowRef<ChatInstance | null>(chat),
    ensureChat: async () => chat,
    clearFailure: () => undefined,
    getEditor: () => store,
    messages: shallowRef({ openSettings: '', requestFailed: '', visionUnavailable: '' }),
    reportError: () => undefined,
    openModelSettings: () => undefined
  })
}

function setup() {
  const card = store.graph.createNode('FRAME', store.state.currentPageId, {
    name: 'Card',
    width: 100,
    height: 60
  })
  const chat = fakeChat(card.id)
  return { card, chat, actions: submission(chat) }
}

const width = (id: string) => store.graph.getNode(id)?.width

test('reverts a turn while its edits are the newest on the undo stack', async () => {
  const { card, actions } = setup()
  await actions.submit({ modelText: 'Wider', displayText: 'Wider', images: [], nodes: [] })
  expect(width(card.id)).toBe(200)
  expect(turnEdits('reply-1')).toEqual({ count: 1, revertable: true })

  expect(revertTurn('reply-1')).toBe(true)
  expect(width(card.id)).toBe(100)
  expect(turnEdits('reply-1')).toBeNull()
})

test('an edit made after the turn closes the revert, so it never undoes other work', async () => {
  const { card, actions } = setup()
  await actions.submit({ modelText: 'Wider', displayText: 'Wider', images: [], nodes: [] })
  store.pushUndoEntry({ label: 'User edit', forward: () => undefined, inverse: () => undefined })

  expect(turnEdits('reply-1')).toEqual({ count: 1, revertable: false })
  expect(revertTurn('reply-1')).toBe(false)
  expect(width(card.id)).toBe(200)
})

test('regenerating undoes the last reply before asking again', async () => {
  const { card, chat, actions } = setup()
  await actions.submit({ modelText: 'Wider', displayText: 'Wider', images: [], nodes: [] })
  await actions.regenerate()

  // 300 is applied to the original 100-wide card, not on top of the first reply's 200.
  expect(width(card.id)).toBe(300)
  store.undoAction()
  expect(width(card.id)).toBe(100)
  expect(chat.messages.map((message) => message.id)).toEqual(['request-0', 'reply-2'])
})

test('resending an edited request replaces it and undoes the old reply first', async () => {
  const { card, chat, actions } = setup()
  await actions.submit({ modelText: 'Wider', displayText: 'Wider', images: [], nodes: [] })
  const request = chat.messages[0]?.id ?? ''
  await actions.resend(request, 'Much wider')

  expect(width(card.id)).toBe(300)
  store.undoAction()
  expect(width(card.id)).toBe(100)
  expect(chat.messages.map((message) => message.id)).toEqual([request, 'reply-2'])
})
