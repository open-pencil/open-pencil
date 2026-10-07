import 'fake-indexeddb/auto'
import { expect, test } from 'bun:test'

import type { UIMessage } from 'ai'
import { reactive } from 'vue'

import { createConversationHistory } from '@/app/ai/chat/history/controller'
import type { ChatDocumentEditor } from '@/app/ai/chat/history/document'
import { createConversationStore } from '@/app/ai/chat/history/idb'

import { expectDefined } from '#tests/helpers/assert'

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
      backend: () => 'direct'
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

function fixture() {
  let activeEditor = editor()
  let failWrites = false
  let resets = 0
  const store = createConversationStore()
  const chat = reactive({
    messages: [] as UIMessage[],
    status: 'ready' as const,
    stop: async () => undefined
  })
  const history = createConversationHistory(
    {
      getEditor: () => activeEditor,
      ensureChat: async () => chat,
      resetChat: async () => {
        resets++
      },
      profileId: () => null,
      backend: () => 'direct'
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
      backend: () => 'direct'
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
