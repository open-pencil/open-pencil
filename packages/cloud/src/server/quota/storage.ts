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

/**
 * Takes the lock an owner's storage allowance is checked under, until the transaction ends.
 * Reservations hold it while they count and reserve; an ownership transfer holds it for both
 * owners, so no reservation counts a workspace under an owner it is leaving or joining.
 */
export function lockStorageAllowance(
  transaction: Transaction<CloudDatabase>,
  ownerId: string
): Promise<void> {
  return lockForTransaction(transaction, `storage-quota:${ownerId}`)
}

export function createStorageQuotaService(database: Kysely<CloudDatabase>) {
  async function ownerOf(executor: StorageDatabase, workspaceId: string): Promise<string | null> {
    const workspace = await executor
      .selectFrom('workspace')
      .select('ownerId')
      .where('id', '=', workspaceId)
      .executeTakeFirst()
    return workspace?.ownerId ?? null
  }

  /**
   * What `ownerId` holds and has reserved across every workspace they own, which all draw from
   * the owner's one allowance. Both totals come from one statement, so an upload committing
   * meanwhile counts once, as committed or as reserved.
   */
  async function usage(
    executor: StorageDatabase,
    ownerId: string,
    now = new Date()
  ): Promise<StorageQuotaSnapshot> {
    const owned = executor.selectFrom('workspace').select('id').where('ownerId', '=', ownerId)
    const row = await executor
      .selectNoFrom((expression) => [
        expression
          .selectFrom('workspaceStorageUsage')
          .select((sum) =>
            sum.fn.coalesce(sum.fn.sum('committedBytes'), sum.val(0)).as('committedBytes')
          )
          .where('workspaceId', 'in', owned)
          .as('committedBytes'),
        expression
          .selectFrom('uploadStorageReservation')
          .select((sum) => sum.fn.coalesce(sum.fn.sum('bytes'), sum.val(0)).as('reservedBytes'))
          .where('workspaceId', 'in', owned)
          .where('committedAt', 'is', null)
          .where('releasedAt', 'is', null)
          .where('expiresAt', '>', now)
          .as('reservedBytes')
      ])
      .executeTakeFirstOrThrow()
    return {
      committedBytes: Number(row.committedBytes ?? 0),
      reservedBytes: Number(row.reservedBytes ?? 0)
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
    // The allowance spans the owner's workspaces, so the owner is what reservations queue on.
    // An ownership transfer holds the same lock, so the owner read once it is held stays put.
    let ownerId = await ownerOf(executor, input.workspaceId)
    for (;;) {
      if (ownerId === null) throw new Error('Workspace not found')
      await lockStorageAllowance(executor, ownerId)
      const current = await ownerOf(executor, input.workspaceId)
      if (current === ownerId) break
      ownerId = current
    }
    await executor
      .insertInto('workspaceStorageUsage')
      .values({ workspaceId: input.workspaceId, committedBytes: 0 })
      .onConflict((conflict) => conflict.column('workspaceId').doNothing())
      .execute()
    const held = await usage(executor, ownerId)
    if (
      input.maximumBytes !== null &&
      held.committedBytes + held.reservedBytes + input.bytes > input.maximumBytes
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
    /** The pooled usage of the workspace's owner, or null when the workspace is gone. */
    async snapshot(workspaceId: string): Promise<StorageQuotaSnapshot | null> {
      const ownerId = await ownerOf(database, workspaceId)
      return ownerId === null ? null : usage(database, ownerId)
    },

    /** What `ownerId` holds and has reserved across every workspace they own. */
    async account(ownerId: string): Promise<StorageQuotaSnapshot> {
      return usage(database, ownerId)
    },

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
