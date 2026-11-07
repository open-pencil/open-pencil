import type { CloudDatabase } from '#cloud/server/db'
import { lockForTransaction } from '#cloud/server/db/expressions'
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
  /**
   * What the workspace's owner holds and has reserved across every workspace they own, which all
   * draw from the owner's one allowance.
   */
  async function snapshot(
    executor: StorageDatabase,
    workspaceId: string,
    now = new Date()
  ): Promise<StorageQuotaSnapshot> {
    const owned = executor
      .selectFrom('workspace')
      .select('id')
      .where(
        'ownerId',
        '=',
        executor.selectFrom('workspace').select('ownerId').where('id', '=', workspaceId)
      )
    const [usage, reservation] = await Promise.all([
      executor
        .selectFrom('workspaceStorageUsage')
        .select((expression) =>
          expression.fn
            .coalesce(expression.fn.sum('committedBytes'), expression.val(0))
            .as('committedBytes')
        )
        .where('workspaceId', 'in', owned)
        .executeTakeFirstOrThrow(),
      executor
        .selectFrom('uploadStorageReservation')
        .select((expression) =>
          expression.fn.coalesce(expression.fn.sum('bytes'), expression.val(0)).as('reservedBytes')
        )
        .where('workspaceId', 'in', owned)
        .where('committedAt', 'is', null)
        .where('releasedAt', 'is', null)
        .where('expiresAt', '>', now)
        .executeTakeFirstOrThrow()
    ])
    return {
      committedBytes: Number(usage.committedBytes),
      reservedBytes: Number(reservation.reservedBytes)
    }
  }

  async function reserve(
    executor: Transaction<CloudDatabase>,
    input: {
      workspaceId: string
      uploadId: string
      bytes: number
      expiresAt: Date
      maximumBytes: number | null
    }
  ): Promise<void> {
    const workspace = await executor
      .selectFrom('workspace')
      .select('ownerId')
      .where('id', '=', input.workspaceId)
      .executeTakeFirstOrThrow()
    // The allowance spans the owner's workspaces, so the owner is what reservations queue on.
    await lockForTransaction(executor, `storage-quota:${workspace.ownerId}`)
    await executor
      .insertInto('workspaceStorageUsage')
      .values({ workspaceId: input.workspaceId, committedBytes: 0 })
      .onConflict((conflict) => conflict.column('workspaceId').doNothing())
      .execute()
    const usage = await snapshot(executor, input.workspaceId)
    if (
      input.maximumBytes !== null &&
      usage.committedBytes + usage.reservedBytes + input.bytes > input.maximumBytes
    ) {
      throw new StorageQuotaExceededError('Workspace storage quota exceeded')
    }
    await executor
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

  async function release(executor: StorageDatabase, uploadId: string): Promise<void> {
    await executor
      .updateTable('uploadStorageReservation')
      .set({ releasedAt: new Date() })
      .where('uploadId', '=', uploadId)
      .where('committedAt', 'is', null)
      .where('releasedAt', 'is', null)
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
      await database.transaction().execute((transaction) => reserve(transaction, input))
    },

    reserveInTransaction(
      transaction: Transaction<CloudDatabase>,
      input: {
        workspaceId: string
        uploadId: string
        bytes: number
        expiresAt: Date
        maximumBytes: number | null
      }
    ): Promise<void> {
      return reserve(transaction, input)
    },

    async commit(uploadId: string): Promise<void> {
      await database.transaction().execute((transaction) => commit(transaction, uploadId))
    },

    commitInTransaction(transaction: Transaction<CloudDatabase>, uploadId: string): Promise<void> {
      return commit(transaction, uploadId)
    },

    async release(uploadId: string): Promise<void> {
      await release(database, uploadId)
    },

    releaseInTransaction(transaction: Transaction<CloudDatabase>, uploadId: string): Promise<void> {
      return release(transaction, uploadId)
    }
  }
}

export type StorageQuotaService = ReturnType<typeof createStorageQuotaService>
