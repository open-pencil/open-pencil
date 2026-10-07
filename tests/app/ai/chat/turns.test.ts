import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import type { ToolExecutionOptions, UIMessage } from 'ai'
import { ref, shallowRef, toRaw } from 'vue'

import { FigmaAPI } from '@open-pencil/core/figma-api'

import { REVERTED_TURN_CONTEXT_MARKER } from '@/app/ai/chat/context'
import { snapshotMessages } from '@/app/ai/chat/history/messages'
import { changePreviewSize } from '@/app/ai/chat/preferences'
import type { ChatInstance } from '@/app/ai/chat/submission/types'
import { useChatSubmission } from '@/app/ai/chat/submission/use'
import { clearTurns, revertOf, revertTurn, turnEdits } from '@/app/ai/chat/turns'
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

type Tools = ReturnType<typeof createAITools>

/**
 * A chat whose every send is one agent run that resizes `nodeId` to the next width, then runs
 * `finish`, such as a view change, before the reply ends. Like `@ai-sdk/vue`'s Chat, it keeps
 * its messages in a deep `ref`, so each message and part is a reactive proxy.
 */
function fakeChat(nodeId: string, finish?: (tools: Tools) => Promise<unknown>) {
  const tools = createAITools(store)
  const widths = [200, 300, 400]
  let replies = 0
  const messages = ref<UIMessage[]>([])
  const chat = {
    status: 'ready' as const,
    get messages(): UIMessage[] {
      return messages.value
    },
    set messages(value: UIMessage[]) {
      messages.value = value
    },
    async reply() {
      startRun(store, 10)
      const width = widths[replies] ?? 500
      replies++
      await tools.node_resize.execute?.({ id: nodeId, width, height: 60 }, call(`call-${replies}`))
      await finish?.(tools)
      chat.messages = [
        ...chat.messages,
        { id: `reply-${replies}`, role: 'assistant', parts: [{ type: 'text', text: 'Done' }] }
      ]
    },
    // Like Chat's, the message is optional; its ID and the text the model reads matter here.
    async sendMessage(message?: { messageId?: string; text?: string }) {
      const messageId = message?.messageId
      const index = chat.messages.findIndex((candidate) => candidate.id === messageId)
      const kept = index === -1 ? chat.messages : chat.messages.slice(0, index)
      const request: UIMessage = {
        id: messageId ?? `request-${replies}`,
        role: 'user',
        parts: [{ type: 'text', text: message?.text ?? '' }]
      }
      chat.messages = [...kept, request]
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
    messages: shallowRef({
      openSettings: '',
      requestFailed: '',
      visionUnavailable: '',
      runSetup: '',
      agentSetup: {
        'companion-missing': '',
        'companion-outdated': '',
        'mcp-outdated': '',
        'pi-sign-in': '',
        'pi-model': ''
      }
    }),
    reportError: () => undefined,
    openModelSettings: () => undefined,
    openSetup: () => undefined,
    // Like the history's flush, this snapshots the messages synchronously, so a message that
    // cannot be cloned throws here instead of becoming a rejected promise.
    flush: () => {
      snapshotMessages(chat.messages)
      return Promise.resolve()
    }
  })
}

function setup(finish?: (tools: Tools) => Promise<unknown>) {
  const card = store.graph.createNode('FRAME', store.state.currentPageId, {
    name: 'Card',
    width: 100,
    height: 60
  })
  const chat = fakeChat(card.id, finish)
  return { card, chat, actions: submission(chat) }
}

const width = (id: string) => store.graph.getNode(id)?.width

test('reverts a turn while its edits are the newest on the undo stack', async () => {
  const { card, actions } = setup()
  await actions.submit({ modelText: 'Wider', displayText: 'Wider', images: [], nodes: [] })
  expect(width(card.id)).toBe(200)
  expect(turnEdits('reply-1')).toEqual({ count: 1, revertable: true, restorable: false })

  expect(revertTurn('reply-1')).toBe(true)
  expect(width(card.id)).toBe(100)
  expect(turnEdits('reply-1')).toEqual({ count: 1, revertable: false, restorable: true })
})

test('a turn that ends with a view change, such as zoom to fit, stays revertable', async () => {
  // The agent often ends a run by framing its work; that edit belongs to the turn too.
  const { card, actions } = setup(async (tools) =>
    tools.viewport_zoom_to_fit.execute?.({}, call('zoom'))
  )
  await actions.submit({ modelText: 'Wider', displayText: 'Wider', images: [], nodes: [] })

  expect(turnEdits('reply-1')?.revertable).toBe(true)
  expect(revertTurn('reply-1')).toBe(true)
  expect(width(card.id)).toBe(100)
})

test('an edit made after the turn closes the revert, so it never undoes other work', async () => {
  const { card, actions } = setup()
  await actions.submit({ modelText: 'Wider', displayText: 'Wider', images: [], nodes: [] })
  store.pushUndoEntry({ label: 'User edit', forward: () => undefined, inverse: () => undefined })

  expect(turnEdits('reply-1')).toEqual({ count: 1, revertable: false, restorable: false })
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

const send = (text: string) => ({ modelText: text, displayText: text, images: [], nodes: [] })

function mark(chat: ReturnType<typeof fakeChat>, id: string) {
  const message = chat.messages.find((candidate) => candidate.id === id)
  return message ? revertOf(message) : undefined
}

function lastRequest(chat: ReturnType<typeof fakeChat>): string {
  const request = chat.messages.findLast((message) => message.role === 'user')
  return request?.parts.map((part) => (part.type === 'text' ? part.text : '')).join('') ?? ''
}

test('a reverted reply stays marked, and the next request tells the model once', async () => {
  const { card, chat, actions } = setup()
  await actions.submit(send('Wider'))
  await actions.revert('reply-1')

  expect(width(card.id)).toBe(100)
  expect(mark(chat, 'reply-1')).toEqual({ reportedIn: undefined })

  await actions.submit(send('Try again'))
  expect(lastRequest(chat)).toContain(REVERTED_TURN_CONTEXT_MARKER)
  expect(lastRequest(chat)).toStartWith('Try again')
  expect(mark(chat, 'reply-1')?.reportedIn).toBe(
    chat.messages.findLast((message) => message.role === 'user')?.id
  )

  await actions.submit(send('And once more'))
  expect(lastRequest(chat)).not.toContain(REVERTED_TURN_CONTEXT_MARKER)
})

test('redoing a reverted reply removes its mark, so nothing is reported', async () => {
  const { card, chat, actions } = setup()
  await actions.submit(send('Wider'))
  await actions.revert('reply-1')
  store.redoAction()

  expect(width(card.id)).toBe(200)
  expect(mark(chat, 'reply-1')).toBeNull()
  expect(turnEdits('reply-1')?.revertable).toBe(true)

  await actions.submit(send('Next'))
  expect(lastRequest(chat)).not.toContain(REVERTED_TURN_CONTEXT_MARKER)
})

test('sending a request again reports a revert from before it', async () => {
  const { chat, actions } = setup()
  await actions.submit(send('Wider'))
  await actions.revert('reply-1')
  await actions.submit(send('Taller'))
  // The second request already reported the revert; editing it sends the note again.
  const request = chat.messages.findLast((message) => message.role === 'user')?.id ?? ''
  await actions.resend(request, 'Much taller')

  expect(lastRequest(chat)).toStartWith('Much taller')
  expect(lastRequest(chat)).toContain(REVERTED_TURN_CONTEXT_MARKER)
})

test('an older reply reverted after later requests is still reported', async () => {
  const { card, chat, actions } = setup()
  await actions.submit(send('Wider'))
  await actions.submit(send('Even wider'))
  await actions.revert('reply-2')
  await actions.submit(send('Smaller then'))
  expect(lastRequest(chat)).toContain(REVERTED_TURN_CONTEXT_MARKER)

  // The third reply's edit is undone too, which leaves the first reply's on top.
  await actions.revert('reply-3')
  await actions.revert('reply-1')
  expect(width(card.id)).toBe(100)
  await actions.submit(send('Start over'))
  expect(lastRequest(chat)).toContain(
    'The user reverted every document edit from 2 of your earlier replies.'
  )
})

test('restoring a reverted reply redoes its edits and removes the mark', async () => {
  const { card, chat, actions } = setup()
  await actions.submit(send('Wider'))
  await actions.revert('reply-1')
  await actions.restore('reply-1')

  expect(width(card.id)).toBe(200)
  expect(mark(chat, 'reply-1')).toBeNull()
  expect(turnEdits('reply-1')).toEqual({ count: 1, revertable: true, restorable: false })
})

test('an edit made after the revert closes the restore, and the reply stays marked', async () => {
  const { card, chat, actions } = setup()
  await actions.submit(send('Wider'))
  await actions.revert('reply-1')
  store.pushUndoEntry({ label: 'User edit', forward: () => undefined, inverse: () => undefined })

  expect(turnEdits('reply-1')?.restorable).toBe(false)
  await actions.restore('reply-1')
  expect(width(card.id)).toBe(100)
  expect(mark(chat, 'reply-1')).toEqual({ reportedIn: undefined })
})
