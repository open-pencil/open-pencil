import 'fake-indexeddb/auto'
import { expect, test } from 'bun:test'

import type { ChatStatus, UIMessage } from 'ai'
import { nextTick, reactive } from 'vue'

import type { ACPAgentID } from '@open-pencil/core/constants'
import { expectDefined } from '@open-pencil/test-support/assert'

import { createConversationHistory } from '@/app/ai/chat/history/controller'
import type { ChatDocumentEditor } from '@/app/ai/chat/history/document'
import { createConversationStore } from '@/app/ai/chat/history/idb'
import type { AgentSessionLink, ConversationStore } from '@/app/ai/chat/history/types'
import { createDeferred } from '@/app/runtime/deferred'
function editor(): ChatDocumentEditor {
  const id = crypto.randomUUID()
  return {
    state: { documentName: 'Test document' },
    getRecoveryId: () => id,
    getSourceIdentity: () => ({ path: null, handle: null }),
    getDocumentFilePath: () => null,
    getStorageBinding: () => null
  }
}

test('adopting recovery in the same editor loads its selection instead of moving old chats', async () => {
  const store = createConversationStore()
  const active = editor()
  const history = createConversationHistory(
    {
      getEditor: () => active,
      ensureChat: async () => null,
      profileId: () => null,
      resetChat: async () => undefined,
      backend: () => 'direct',
      resumingAgent: () => null
    },
    store
  )
  await history.initialize()
  const original = history.current.value
  if (!original) throw new Error('Missing draft')
  await history.rename(original.id, 'Existing chat')
  const recoveryId = crypto.randomUUID()
  const restoredId = crypto.randomUUID()
  await store.write({
    ...original,
    id: restoredId,
    documentId: `recovery:${recoveryId}`,
    title: 'Recovered chat',
    titleSource: 'manual'
  })
  await store.select(`recovery:${recoveryId}`, restoredId)
  active.getRecoveryId = () => recoveryId
  await history.initialize()
  expect(history.current.value?.id).toBe(restoredId)
  expect((await store.read(original.id))?.documentId).toBe(original.documentId)
})

function fixture(title?: (messages: UIMessage[]) => Promise<string | null>) {
  let activeEditor = editor()
  let failWrites = false
  let resets = 0
  const store = createConversationStore()
  const chat = reactive({
    messages: [] as UIMessage[],
    status: 'ready' as ChatStatus,
    stop: async () => undefined
  })
  const history = createConversationHistory(
    {
      title,
      getEditor: () => activeEditor,
      ensureChat: async () => chat,
      resetChat: async () => {
        resets++
      },
      profileId: () => null,
      backend: () => 'direct',
      resumingAgent: () => null
    },
    {
      ...store,
      write: async (row) => {
        if (failWrites) throw new DOMException('Storage full', 'QuotaExceededError')
        await store.write(row)
      }
    }
  )
  return {
    history,
    store,
    chat,
    setFail: (value: boolean) => {
      failWrites = value
    },
    getResets: () => resets,
    switchEditor: () => {
      activeEditor = editor()
    }
  }
}

test('failed flush keeps the current conversation and blocks switching until retry succeeds', async () => {
  const f = fixture()
  await f.history.ensureChat()
  const id = f.history.current.value?.id
  f.chat.messages = [
    { id: 'message', role: 'user', parts: [{ type: 'text', text: 'Keep this draft' }] }
  ]
  f.setFail(true)
  await expect(f.history.newChat()).rejects.toThrow('Storage full')
  expect(f.history.current.value?.id).toBe(id)
  expect(f.history.messages.value[0]?.id).toBe('message')
  expect(f.history.storageError.value).toBe(true)
  f.setFail(false)
  await f.history.newChat()
  expect(f.history.current.value?.id).not.toBe(id)
  expect(f.history.storageError.value).toBe(false)
  if (!id) throw new Error('Missing conversation')
  expect((await f.store.read(id))?.messages[0]?.message.id).toBe('message')
})

test('queued chat switches finish on the last requested conversation without losing transcripts', async () => {
  const f = fixture()
  await f.history.initialize()
  const first = f.history.current.value?.id
  if (first) await f.history.rename(first, 'First')
  await f.history.newChat()
  const second = f.history.current.value?.id
  if (second) await f.history.rename(second, 'Second')
  if (!first || !second) throw new Error('Missing conversation')
  await Promise.all(
    Array.from({ length: 20 }, (_, index) => f.history.open(index % 2 === 0 ? first : second))
  )
  const current = expectDefined(f.history.current.value, 'current conversation')
  expect(current.id).toBe(second)
  expect(await f.store.getSelected(current.documentId)).toBe(second)
  expect(await f.store.read(first)).not.toBeNull()
  expect(f.history.busy.value).toBe(false)
})

test('opening the panel and repeatedly creating drafts does not persist empty chats', async () => {
  const f = fixture()
  await f.history.initialize()
  const documentId = f.history.current.value?.documentId
  await f.history.newChat()
  await f.history.newChat()
  expect(await f.store.list(documentId)).toEqual([])
  if (!documentId) throw new Error('Missing document')
  expect(await f.store.getSelected(documentId)).toBeNull()
})

test('a pending transport is rejected when the active document changes', async () => {
  let activeEditor = editor()
  const pending = Promise.withResolvers<{
    messages: UIMessage[]
    status: 'ready'
    stop: () => Promise<void>
  }>()
  const started = Promise.withResolvers<undefined>()
  let stops = 0
  const history = createConversationHistory(
    {
      getEditor: () => activeEditor,
      ensureChat: () => {
        started.resolve(undefined)
        return pending.promise
      },
      profileId: () => null,
      resetChat: async () => undefined,
      backend: () => 'direct',
      resumingAgent: () => null
    },
    createConversationStore()
  )
  const initializing = history.ensureChat()
  await started.promise
  activeEditor = editor()
  pending.resolve({
    messages: [],
    status: 'ready',
    stop: async () => {
      stops++
    }
  })
  expect(await initializing).toBeNull()
  expect(stops).toBe(1)
})

/** A Claude Code chat whose history holds `saved`, with `agent` as the chat's current agent. */
async function agentFixture(initialAgent: ACPAgentID | null, saved?: { messages: UIMessage[] }) {
  const active = editor()
  let agent = initialAgent
  let starts = true
  const store = createConversationStore()
  const chat = reactive({
    messages: [] as UIMessage[],
    status: 'ready' as const,
    stop: async () => undefined
  })
  const links: (AgentSessionLink | undefined)[] = []
  const history = createConversationHistory(
    {
      getEditor: () => active,
      ensureChat: async (messages, _sessionId, link) => {
        links.push(link)
        if (!starts) return null
        chat.messages = messages ?? []
        return chat
      },
      resetChat: async () => undefined,
      profileId: () => null,
      backend: () => 'acp',
      resumingAgent: () => agent
    },
    store
  )
  await history.initialize()
  const draft = expectDefined(history.current.value, 'draft conversation')
  if (saved) {
    await store.write({
      ...draft,
      title: 'Saved agent chat',
      titleSource: 'manual',
      backend: 'acp',
      agentSession: { agent: 'claude-code', id: 'claude-session' },
      messages: saved.messages.map((message) => ({ message, attachments: [] }))
    })
    // Away and back, so the saved row is what opens.
    await history.newChat()
    await history.open(draft.id)
  }
  return {
    history,
    store,
    chat,
    links,
    id: draft.id,
    switchAgent: (next: ACPAgentID | null) => {
      agent = next
    },
    /** Whether the next chat starts, or fails as for an unconfigured provider. */
    setStarts: (next: boolean) => {
      starts = next
    }
  }
}

const savedMessage: UIMessage = {
  id: 'saved',
  role: 'user',
  parts: [{ type: 'text', text: 'Make the hero bigger' }]
}

test('disposing for a reload stops and saves the chat before releasing its agent', async () => {
  const active = editor()
  const store = createConversationStore()
  const stopping = createDeferred<undefined>()
  const stopped = createDeferred<undefined>()
  const chat = reactive({
    messages: [savedMessage],
    status: 'streaming' as ChatStatus,
    async stop() {
      stopping.resolve(undefined)
      await stopped.promise
      chat.status = 'ready'
    }
  })
  let resets = 0
  let id = ''
  const runtime = {
    getEditor: () => active,
    ensureChat: async () => chat,
    resetChat: async () => {
      if (id) {
        const saved = await store.read(id)
        expect(saved?.messages[0]?.message).toEqual(savedMessage)
        expect(saved?.agentSession).toEqual({ agent: 'codex', id: 'codex-session' })
        expect(saved?.interrupted).toBe(true)
      }
      resets++
    },
    profileId: () => null,
    backend: () => 'acp' as const,
    resumingAgent: () => 'codex' as const
  }
  const history = createConversationHistory(runtime, store)
  await history.ensureChat()
  const conversation = expectDefined(history.current.value, 'conversation')
  id = conversation.id
  history.current.value = {
    ...conversation,
    agentSession: { agent: 'codex', id: 'codex-session' }
  }
  const before = resets
  const disposing = history.dispose()
  await stopping.promise
  expect(resets).toBe(before)
  // A follow-up triggered by Stop must not launch another agent during teardown.
  const queued = history.ensureChat()
  expect(history.dispose()).toBe(disposing)
  stopped.resolve(undefined)
  await disposing
  expect(await queued).toBeNull()
  expect(resets).toBe(before + 1)
  expect(await store.getSelected(conversation.documentId)).toBe(id)

  const reopened = createConversationHistory(runtime, store)
  await reopened.initialize()
  expect(reopened.current.value?.id).toBe(id)
  expect(reopened.continuesAgentSession.value).toBe(true)
  expect(reopened.agentReadOnly.value).toBe(false)
})

test('a disposal whose save failed saves on the next call, and no chat starts in between', async () => {
  const active = editor()
  const real = createConversationStore()
  let failing = false
  const store: ConversationStore = {
    ...real,
    write: async (conversation) => {
      if (failing) throw new Error('Storage is unavailable')
      await real.write(conversation)
    }
  }
  const chat = reactive({
    messages: [savedMessage],
    status: 'ready' as ChatStatus,
    stop: async () => undefined
  })
  let resets = 0
  let starts = 0
  const history = createConversationHistory(
    {
      getEditor: () => active,
      ensureChat: async () => {
        starts++
        return chat
      },
      resetChat: async () => {
        resets++
      },
      profileId: () => null,
      backend: () => 'acp' as const,
      resumingAgent: () => 'codex' as const
    },
    store
  )
  await history.ensureChat()
  const id = expectDefined(history.current.value, 'conversation').id
  const before = { resets, starts }

  failing = true
  await expect(history.dispose()).rejects.toThrow('Storage is unavailable')
  expect(resets).toBe(before.resets)
  expect(await history.ensureChat()).toBeNull()

  failing = false
  await history.dispose()
  expect(resets).toBe(before.resets + 1)
  expect(starts).toBe(before.starts)
  expect((await real.read(id))?.messages[0]?.message).toEqual(savedMessage)
})

test('a saved agent conversation continues in its session with the agent that resumes it', async () => {
  const f = await agentFixture('claude-code', { messages: [savedMessage] })
  expect(f.history.continuesAgentSession.value).toBe(true)
  expect(f.history.agentReadOnly.value).toBe(false)
  expect(await f.history.ensureChat()).toBe(f.chat)
  expect(f.links.at(-1)?.resume).toBe('claude-session')
  expect(f.chat.messages.map((message) => message.id)).toEqual(['saved'])
})

test('a saved agent conversation stays read-only for an agent that cannot resume it', async () => {
  const f = await agentFixture(null, { messages: [savedMessage] })
  expect(f.history.continuesAgentSession.value).toBe(false)
  expect(f.history.agentReadOnly.value).toBe(true)
  expect(await f.history.ensureChat()).toBeNull()
  expect(f.links).toEqual([])
})

test('the agent session a turn ran in is saved with its conversation', async () => {
  const f = await agentFixture('claude-code')
  await f.history.ensureChat()
  const link = expectDefined(f.links.at(-1), 'agent session link')
  expect(link.resume).toBeNull()
  f.chat.messages = [savedMessage]
  link.record({ agent: 'claude-code', id: 'new-session' })
  await f.history.flush()
  expect((await f.store.read(f.id))?.agentSession).toEqual({
    agent: 'claude-code',
    id: 'new-session'
  })
  expect(f.history.continuesAgentSession.value).toBe(true)
})

test('a session reported after switching conversations is not saved on the new one', async () => {
  const f = await agentFixture('claude-code')
  await f.history.ensureChat()
  const link = expectDefined(f.links.at(-1), 'agent session link')
  f.chat.messages = [savedMessage]
  await f.history.newChat()
  const other = expectDefined(f.history.current.value, 'new conversation')
  link.record({ agent: 'claude-code', id: 'late-session' })
  await f.history.flush()
  expect(f.history.current.value?.agentSession).toBeUndefined()
  expect((await f.store.read(f.id))?.agentSession).toBeUndefined()
  expect(other.id).not.toBe(f.id)
})

test('a saved session the agent can no longer continue is forgotten', async () => {
  const f = await agentFixture('claude-code', { messages: [savedMessage] })
  await f.history.ensureChat()
  expectDefined(f.links.at(-1), 'agent session link').record(null)
  await f.history.flush()
  expect((await f.store.read(f.id))?.agentSession).toBeUndefined()
  expect(f.history.continuesAgentSession.value).toBe(false)
})

test('a saved session stays read-only for another agent that resumes its own sessions', async () => {
  const f = await agentFixture('codex', { messages: [savedMessage] })
  expect(f.history.continuesAgentSession.value).toBe(false)
  expect(f.history.agentReadOnly.value).toBe(true)
  expect(await f.history.ensureChat()).toBeNull()
  expect(f.links).toEqual([])
})

test('a saved session is kept until a chat on another agent starts', async () => {
  const f = await agentFixture('claude-code')
  await f.history.ensureChat()
  f.chat.messages = [savedMessage]
  expectDefined(f.links.at(-1), 'agent session link').record({ agent: 'claude-code', id: 'kept' })
  f.switchAgent('codex')
  f.setStarts(false)
  expect(await f.history.ensureChat()).toBeNull()
  expect(f.history.current.value?.agentSession).toEqual({ agent: 'claude-code', id: 'kept' })
  f.setStarts(true)
  expect(await f.history.ensureChat()).toBe(f.chat)
  expect(f.history.current.value?.agentSession).toBeUndefined()
})

test('a chat whose saved session could not be continued takes no more messages', async () => {
  const f = await agentFixture('claude-code', { messages: [savedMessage] })
  await f.history.ensureChat()
  expectDefined(f.links.at(-1), 'agent session link').record(null)
  expect(f.history.chatEnded.value).toBe(true)
  expect(f.history.agentReadOnly.value).toBe(true)
  expect(await f.history.ensureChat()).toBeNull()
  expect(f.links).toHaveLength(1)
  // A new chat starts clean.
  await f.history.newChat()
  expect(f.history.chatEnded.value).toBe(false)
})

test('a conversation continued on another agent no longer resumes the saved session', async () => {
  const f = await agentFixture('claude-code', { messages: [savedMessage] })
  await f.history.ensureChat()
  f.switchAgent(null)
  await f.history.ensureChat()
  await f.history.flush()
  expect((await f.store.read(f.id))?.agentSession).toBeUndefined()
  // Back on Claude Code, the new session missed the turns in between, so it is not saved.
  f.switchAgent('claude-code')
  await f.history.ensureChat()
  const link = expectDefined(f.links.at(-1), 'agent session link')
  expect(link.resume).toBeNull()
  link.record({ agent: 'claude-code', id: 'partial-session' })
  await f.history.flush()
  expect((await f.store.read(f.id))?.agentSession).toBeUndefined()
})

/** One request and its reply, as the chat holds them once the reply is in. */
const exchange: UIMessage[] = [
  { id: 'ask', role: 'user', parts: [{ type: 'text', text: 'Make the cards the same height' }] },
  { id: 'reply', role: 'assistant', parts: [{ type: 'text', text: 'Done.' }] }
]

/** The chat takes a message and finishes its reply, as a turn does. */
async function reply(chat: { messages: UIMessage[]; status: ChatStatus }): Promise<void> {
  chat.status = 'streaming'
  await nextTick()
  chat.messages = exchange
  chat.status = 'ready'
  await nextTick()
}

/** Naming runs beside the chat, so a test waits for the title it expects to land. */
async function named(history: { current: { value: { titleSource: string } | null } }) {
  for (let turn = 0; turn < 50 && history.current.value?.titleSource !== 'generated'; turn++) {
    await Bun.sleep(0)
  }
}

test('a conversation is named once its first reply is in, and keeps the name', async () => {
  const asked: UIMessage[][] = []
  const f = fixture(async (messages) => {
    asked.push(messages)
    return 'Equal-height cards'
  })
  await f.history.ensureChat()
  const id = expectDefined(f.history.current.value?.id, 'a conversation')
  await reply(f.chat)
  await named(f.history)
  await f.history.flush()
  expect(asked).toHaveLength(1)
  expect(f.history.current.value).toMatchObject({
    title: 'Equal-height cards',
    titleSource: 'generated'
  })
  expect(await f.store.read(id)).toMatchObject({
    title: 'Equal-height cards',
    titleSource: 'generated'
  })

  await reply(f.chat)
  await f.history.flush()
  expect(asked).toHaveLength(1)
})

test('a name the person typed is not replaced by a generated one', async () => {
  const answer = createDeferred<string | null>()
  const f = fixture(() => answer.promise)
  await f.history.ensureChat()
  const id = expectDefined(f.history.current.value?.id, 'a conversation')
  await reply(f.chat)
  await f.history.rename(id, 'My own name')
  answer.resolve('Generated name')
  await f.history.flush()
  expect(f.history.current.value).toMatchObject({ title: 'My own name', titleSource: 'manual' })
})

test('a conversation keeps its first message as the title when none is generated', async () => {
  const f = fixture(async () => null)
  await f.history.ensureChat()
  await reply(f.chat)
  await f.history.flush()
  expect(f.history.current.value).toMatchObject({
    title: 'Make the cards the same height',
    titleSource: 'fallback'
  })
})
