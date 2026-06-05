import { desc, eq, lt } from 'drizzle-orm'

import type { ApiDatabase } from './db/client.js'
import { createMigratedApiDatabase } from './db/migrate.js'
import { notifications, users } from './db/schema.js'
import type {
  CreateNotificationInput,
  NotificationPayload,
  NotificationRecord,
  NotificationStore,
  TeamUserRecord
} from './types.js'

export interface CreateNotificationStoreOptions {
  database?: ApiDatabase
  now?: () => number
  onNotificationCreated?: (notification: NotificationRecord) => void
}

export const DEFAULT_NOTIFICATION_SWEEP_OLDER_THAN_MS = 30 * 24 * 3600 * 1000

function createInMemoryDatabase() {
  return createMigratedApiDatabase({ mode: 'memory' })
}

function cloneNotification(record: NotificationRecord): NotificationRecord {
  return structuredClone(record)
}

function mapUser(row: typeof users.$inferSelect): TeamUserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image ?? null
  }
}

function parsePayload(payload: string): NotificationPayload {
  return JSON.parse(payload) as NotificationPayload
}

function mapNotification(row: typeof notifications.$inferSelect): NotificationRecord {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as NotificationRecord['type'],
    payload: parsePayload(row.payload),
    readAt: row.readAt,
    createdAt: row.createdAt
  }
}

function sortNotifications(records: NotificationRecord[]) {
  return [...records].sort((left, right) => {
    const leftUnread = left.readAt === null
    const rightUnread = right.readAt === null
    if (leftUnread !== rightUnread) return leftUnread ? -1 : 1
    return right.createdAt - left.createdAt
  })
}

export function createNotificationStore(
  options: CreateNotificationStoreOptions = {}
): NotificationStore {
  const database = options.database ?? createInMemoryDatabase()
  const now = options.now ?? Date.now
  const onNotificationCreated = options.onNotificationCreated

  return {
    createNotification(input: CreateNotificationInput) {
      const record: NotificationRecord = {
        id: crypto.randomUUID(),
        userId: input.userId,
        type: input.type,
        payload: structuredClone(input.payload),
        readAt: null,
        createdAt: now()
      }

      database.db
        .insert(notifications)
        .values({
          id: record.id,
          userId: record.userId,
          type: record.type,
          payload: JSON.stringify(record.payload),
          readAt: record.readAt,
          createdAt: record.createdAt
        })
        .run()

      const clonedRecord = cloneNotification(record)
      onNotificationCreated?.(clonedRecord)
      return clonedRecord
    },
    findNotification(id: string) {
      const row = database.db.select().from(notifications).where(eq(notifications.id, id)).get()
      return row ? cloneNotification(mapNotification(row)) : null
    },
    findUserByEmail(email: string) {
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) return null
      const row = database.db.select().from(users).where(eq(users.email, normalizedEmail)).get()
      return row ? structuredClone(mapUser(row)) : null
    },
    listNotificationsForUser(userId: string) {
      const rows = database.db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .all()

      return sortNotifications(rows.map((row) => cloneNotification(mapNotification(row))))
    },
    markNotificationRead(id: string, userId: string) {
      const record = this.findNotification(id)
      if (!record || record.userId !== userId) return null
      if (record.readAt !== null) return record

      database.db
        .update(notifications)
        .set({ readAt: now() })
        .where(eq(notifications.id, id))
        .run()

      return this.findNotification(id)
    },
    markAllNotificationsRead(userId: string) {
      return database.db
        .update(notifications)
        .set({ readAt: now() })
        .where(eq(notifications.userId, userId))
        .run().changes
    },
    deleteNotification(id: string, userId: string) {
      const record = this.findNotification(id)
      if (!record || record.userId !== userId) return null
      database.db.delete(notifications).where(eq(notifications.id, id)).run()
      return record
    },
    sweepOldNotifications(olderThanMs = DEFAULT_NOTIFICATION_SWEEP_OLDER_THAN_MS) {
      const threshold = now() - olderThanMs
      return database.db
        .delete(notifications)
        .where(lt(notifications.createdAt, threshold))
        .run().changes
    }
  }
}
