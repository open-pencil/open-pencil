import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely, Transaction } from 'kysely'

export class StorageQuotaExceededError extends Error {
  override readonly name = 'StorageQuotaExceededError'
}

export type StorageQuotaSnapshot = {
  committedBytes: number
  reservedBytes: number
}

type StorageDatabase = Kysely<CloudDatabase> | Transaction<CloudDatabase>

export function createStorageQuotaService(database: Kysely<CloudDatabase>) {
  async function snapshot(
    executor: StorageDatabase,
    workspaceId: string,
    now = new Date()
  ): Promise<StorageQuotaSnapshot> {
    const [usage, reservation] = await Promise.all([
      executor
        .selectFrom('workspaceStorageUsage')
        .select('committedBytes')
        .where('workspaceId', '=', workspaceId)
        .executeTakeFirst(),
      executor
        .selectFrom('uploadStorageReservation')
        .select((expression) =>
          expression.fn.coalesce(expression.fn.sum('bytes'), expression.val(0)).as('reservedBytes')
        )
        .where('workspaceId', '=', workspaceId)
        .where('committedAt', 'is', null)
        .where('releasedAt', 'is', null)
        .where('expiresAt', '>', now)
        .executeTakeFirstOrThrow()
    ])
    return {
      committedBytes: Number(usage?.committedBytes ?? 0),
      reservedBytes: Number(reservation.reservedBytes)
    }
  }

  async function commit(executor: StorageDatabase, uploadId: string): Promise<void> {
    const reservation = await executor
      .selectFrom('uploadStorageReservation')
      .select(['id', 'workspaceId', 'bytes', 'committedAt', 'releasedAt'])
      .where('uploadId', '=', uploadId)
      .forUpdate()
      .executeTakeFirst()
    if (!reservation || reservation.committedAt || reservation.releasedAt) return
    await executor
      .updateTable('workspaceStorageUsage')
      .set({
        committedBytes: (expression) =>
          expression('committedBytes', '+', Number(reservation.bytes)),
        updatedAt: new Date()
      })
      .where('workspaceId', '=', reservation.workspaceId)
      .execute()
    await executor
      .updateTable('uploadStorageReservation')
      .set({ committedAt: new Date() })
      .where('id', '=', reservation.id)
      .execute()
  }

  return {
    snapshot: (workspaceId: string) => snapshot(database, workspaceId),

    async reserve(input: {
      workspaceId: string
      uploadId: string
      bytes: number
      expiresAt: Date
      maximumBytes: number | null
    }): Promise<void> {
      await database.transaction().execute(async (transaction) => {
        await transaction
          .insertInto('workspaceStorageUsage')
          .values({ workspaceId: input.workspaceId, committedBytes: 0 })
          .onConflict((conflict) => conflict.column('workspaceId').doNothing())
          .execute()
        await transaction
          .selectFrom('workspaceStorageUsage')
          .select('workspaceId')
          .where('workspaceId', '=', input.workspaceId)
          .forUpdate()
          .executeTakeFirstOrThrow()
        const usage = await snapshot(transaction, input.workspaceId)
        if (
          input.maximumBytes !== null &&
          usage.committedBytes + usage.reservedBytes + input.bytes > input.maximumBytes
        ) {
          throw new StorageQuotaExceededError('Workspace storage quota exceeded')
        }
        await transaction
          .insertInto('uploadStorageReservation')
          .values({
            id: crypto.randomUUID(),
            workspaceId: input.workspaceId,
            uploadId: input.uploadId,
            bytes: input.bytes,
            expiresAt: input.expiresAt,
            committedAt: null,
            releasedAt: null
          })
          .onConflict((conflict) => conflict.column('uploadId').doNothing())
          .execute()
      })
    },

    async commit(uploadId: string): Promise<void> {
      await database.transaction().execute((transaction) => commit(transaction, uploadId))
    },

    commitInTransaction(transaction: Transaction<CloudDatabase>, uploadId: string): Promise<void> {
      return commit(transaction, uploadId)
    },

    async release(uploadId: string): Promise<void> {
      await database
        .updateTable('uploadStorageReservation')
        .set({ releasedAt: new Date() })
        .where('uploadId', '=', uploadId)
        .where('committedAt', 'is', null)
        .where('releasedAt', 'is', null)
        .execute()
    }
  }
}

export type StorageQuotaService = ReturnType<typeof createStorageQuotaService>
