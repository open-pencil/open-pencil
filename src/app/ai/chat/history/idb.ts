import type { DBSchema } from 'idb'

import { APP_DATABASE_NAMES, defineAppDatabase, openAppDatabase } from '@/app/storage/idb'

import { fromStorableBlobs, toStorableBlobs } from './blobs'
import type { Conversation, ConversationMeta, ConversationStore } from './types'

interface ChatDatabase extends DBSchema {
  conversations: { key: string; value: ConversationMeta; indexes: { document: string } }
  /** `Conversation['messages']` with each Blob stored as bytes (`./blobs`). */
  messages: { key: string; value: unknown }
  files: { key: string; value: FileSystemFileHandle }
  deleted: { key: string; value: true }
  selected: { key: string; value: string }
}

const definition = defineAppDatabase<ChatDatabase>({
  name: APP_DATABASE_NAMES.chats,
  version: 3,
  callbacks: {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database
          .createObjectStore('conversations', { keyPath: 'id' })
          .createIndex('document', 'documentId')
        database.createObjectStore('messages')
        database.createObjectStore('selected')
      }
      if (oldVersion < 2) database.createObjectStore('deleted')
      if (oldVersion < 3) database.createObjectStore('files')
    }
  }
})

/** Transcript snapshots and Blob previews are committed atomically with their list metadata. */
export function createConversationStore(): ConversationStore {
  let database: ReturnType<typeof openAppDatabase<ChatDatabase>> | undefined
  const getDatabase = () => (database ??= openAppDatabase(definition))
  return {
    async list(documentId) {
      const db = await getDatabase()
      const rows =
        documentId === undefined
          ? await db.getAll('conversations')
          : await db.getAllFromIndex('conversations', 'document', documentId)
      return rows.toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    },
    async read(id) {
      const transaction = (await getDatabase()).transaction(['conversations', 'messages'])
      const meta = await transaction.objectStore('conversations').get(id)
      const messages = await transaction.objectStore('messages').get(id)
      await transaction.done
      if (!meta) return null
      // Written only by `write` below, from `Conversation['messages']`.
      const restored = fromStorableBlobs(messages ?? []) as Conversation['messages']
      return { ...meta, messages: restored }
    },
    async write(conversation) {
      const { messages, ...meta } = conversation
      // Before the transaction opens: awaiting anything but its own requests would end it.
      const stored = await toStorableBlobs(messages)
      const transaction = (await getDatabase()).transaction(
        ['conversations', 'messages', 'deleted'],
        'readwrite'
      )
      if (await transaction.objectStore('deleted').get(meta.id)) {
        await transaction.done
        throw new Error('Conversation was deleted')
      }
      const existing = await transaction.objectStore('conversations').get(meta.id)
      if (existing) {
        meta.documentId = existing.documentId
        meta.documentName = existing.documentName
      }
      // A delayed streaming snapshot must not undo a manual rename.
      if (existing?.titleSource === 'manual') {
        meta.title = existing.title
        meta.titleSource = 'manual'
      }
      await transaction.objectStore('conversations').put(meta)
      await transaction.objectStore('messages').put(stored, meta.id)
      await transaction.done
    },
    async rename(id, title) {
      const trimmed = title.trim()
      if (!trimmed) return
      const transaction = (await getDatabase()).transaction('conversations', 'readwrite')
      const meta = await transaction.store.get(id)
      if (meta) await transaction.store.put({ ...meta, title: trimmed, titleSource: 'manual' })
      await transaction.done
    },
    async remove(id) {
      const transaction = (await getDatabase()).transaction(
        ['conversations', 'messages', 'selected', 'deleted'],
        'readwrite'
      )
      await transaction.objectStore('deleted').put(true, id)
      await transaction.objectStore('conversations').delete(id)
      await transaction.objectStore('messages').delete(id)
      let cursor = await transaction.objectStore('selected').openCursor()
      while (cursor) {
        if (cursor.value === id) await cursor.delete()
        cursor = await cursor.continue()
      }
      await transaction.done
    },
    async resolveFile(handle) {
      return navigator.locks.request('open-pencil-chat-file-identity', async () => {
        const db = await getDatabase()
        // isSameEntry is asynchronous and must run outside an IDB transaction.
        const transaction = db.transaction('files')
        const keys = await transaction.store.getAllKeys()
        const handles = await transaction.store.getAll()
        await transaction.done
        for (const [index, saved] of handles.entries()) {
          try {
            if (await saved.isSameEntry(handle)) return String(keys[index])
          } catch {
            console.warn('[Chat history] Could not compare a saved file handle')
          }
        }
        const id = `browser-file:${crypto.randomUUID()}`
        await db.put('files', handle, id)
        return id
      })
    },
    async reassignDocument(from, to, name) {
      const transaction = (await getDatabase()).transaction(
        ['conversations', 'selected'],
        'readwrite'
      )
      const rows = await transaction.objectStore('conversations').index('document').getAll(from)
      for (const row of rows) {
        await transaction
          .objectStore('conversations')
          .put({ ...row, documentId: to, documentName: name })
      }
      const selected = await transaction.objectStore('selected').get(from)
      if (selected) await transaction.objectStore('selected').put(selected, to)
      if (from !== to) await transaction.objectStore('selected').delete(from)
      await transaction.done
    },
    async getSelected(documentId) {
      return (await (await getDatabase()).get('selected', documentId)) ?? null
    },
    async select(documentId, id) {
      const transaction = (await getDatabase()).transaction(
        ['conversations', 'selected'],
        'readwrite'
      )
      const meta = await transaction.objectStore('conversations').get(id)
      if (!meta || meta.documentId !== documentId) {
        transaction.abort()
        await transaction.done.catch(() => undefined)
        throw new Error('Conversation belongs to a different document')
      }
      await transaction.objectStore('selected').put(id, documentId)
      await transaction.done
    }
  }
}
