import type { DBSchema } from 'idb'

import { APP_DATABASE_NAMES, defineAppDatabase, openAppDatabase } from '@/app/storage/idb'

import { getDiagnosticsRetention, type DiagnosticsRetention } from './settings'
import type { DiagnosticCategory, DiagnosticEvent } from './types'

interface DiagnosticsDatabase extends DBSchema {
  events: {
    key: string
    value: DiagnosticEvent
    indexes: {
      'by-timestamp': number
      'by-category': DiagnosticCategory
    }
  }
}

const diagnosticsDatabase = defineAppDatabase<DiagnosticsDatabase>({
  name: APP_DATABASE_NAMES.diagnostics,
  version: 1,
  callbacks: {
    upgrade(database) {
      if (database.objectStoreNames.contains('events')) return
      const events = database.createObjectStore('events', { keyPath: 'id' })
      events.createIndex('by-timestamp', 'timestamp')
      events.createIndex('by-category', 'category')
    }
  }
})

export type DiagnosticsStore = {
  record(event: DiagnosticEvent): Promise<void>
  list(): Promise<DiagnosticEvent[]>
  prune(retention: DiagnosticsRetention): Promise<void>
  clear(): Promise<void>
}

export function createIDBDiagnosticsStore(): DiagnosticsStore {
  const database = openAppDatabase(diagnosticsDatabase)

  async function prune(retention: DiagnosticsRetention): Promise<void> {
    const db = await database
    const transaction = db.transaction('events', 'readwrite')
    const keys = await transaction.store.index('by-timestamp').getAllKeys()
    for (const key of keys.slice(0, Math.max(0, keys.length - retention))) {
      await transaction.store.delete(key)
    }
    await transaction.done
  }

  return {
    async record(event) {
      const db = await database
      const transaction = db.transaction('events', 'readwrite')
      await transaction.store.put(event)
      await transaction.done
      await prune(getDiagnosticsRetention())
    },
    async list() {
      return (await (await database).getAllFromIndex('events', 'by-timestamp')).reverse()
    },
    prune,
    async clear() {
      await (await database).clear('events')
    }
  }
}
