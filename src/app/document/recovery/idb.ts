import { openDB, type DBSchema } from 'idb'

import type {
  RecoverySnapshot,
  RecoverySnapshotInput,
  RecoverySnapshotMeta,
  RecoveryStore
} from '@/app/document/recovery/types'

const DB_NAME = 'open-pencil-recovery'
const DB_VERSION = 1

interface RecoveryDatabase extends DBSchema {
  meta: {
    key: string
    value: RecoverySnapshotMeta
  }
  fig: {
    key: string
    value: Uint8Array
  }
}

export function createIdbRecoveryStore(): RecoveryStore {
  const database = openDB<RecoveryDatabase>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('fig')) db.createObjectStore('fig')
    }
  })

  return {
    async list() {
      const rows = await (await database).getAll('meta')
      return rows.toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    },

    async read(id: string) {
      const db = await database
      const transaction = db.transaction(['meta', 'fig'])
      const [metadata, figBytes] = await Promise.all([
        transaction.objectStore('meta').get(id),
        transaction.objectStore('fig').get(id)
      ])
      await transaction.done
      return metadata && figBytes
        ? ({ ...metadata, figBytes: Uint8Array.from(figBytes) } satisfies RecoverySnapshot)
        : null
    },

    async write(input: RecoverySnapshotInput) {
      const db = await database
      const transaction = db.transaction(['meta', 'fig'], 'readwrite')
      const metadata: RecoverySnapshotMeta = {
        id: input.id,
        documentName: input.documentName || 'Untitled',
        updatedAt: new Date().toISOString(),
        sceneVersion: input.sceneVersion,
        byteLength: input.figBytes.byteLength,
        formatVersion: 1
      }
      await Promise.all([
        transaction.objectStore('meta').put(metadata),
        transaction.objectStore('fig').put(Uint8Array.from(input.figBytes), input.id),
        transaction.done
      ])
      return metadata
    },

    async remove(id: string) {
      const db = await database
      const transaction = db.transaction(['meta', 'fig'], 'readwrite')
      await Promise.all([
        transaction.objectStore('meta').delete(id),
        transaction.objectStore('fig').delete(id),
        transaction.done
      ])
    },

    async clear() {
      const db = await database
      const transaction = db.transaction(['meta', 'fig'], 'readwrite')
      await Promise.all([
        transaction.objectStore('meta').clear(),
        transaction.objectStore('fig').clear(),
        transaction.done
      ])
    }
  }
}
