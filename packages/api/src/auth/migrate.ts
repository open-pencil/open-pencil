import { and, eq, inArray } from 'drizzle-orm'

import type { ApiDatabase } from '../db/client.js'
import { boards, collaborators } from '../db/schema.js'

export interface MigrateAnonymousOwnershipOptions {
  database: ApiDatabase
  anonymousId: string
  userId: string
  now?: () => number
}

export interface MigrateAnonymousOwnershipResult {
  migratedBoardCount: number
  removedOwnerCollaboratorCount: number
}

export async function migrateAnonymousOwnership(
  options: MigrateAnonymousOwnershipOptions
): Promise<MigrateAnonymousOwnershipResult> {
  const anonymousId = options.anonymousId.trim()
  const userId = options.userId.trim()
  const now = options.now ?? Date.now

  if (!anonymousId || !userId) {
    return {
      migratedBoardCount: 0,
      removedOwnerCollaboratorCount: 0
    }
  }

  return await options.database.db.transaction(async (tx) => {
    const ownedBoardIds = (await tx
      .select({ id: boards.id })
      .from(boards)
      .where(eq(boards.creatorAnonymousId, anonymousId))
      .all())
      .map((row) => row.id)

    if (ownedBoardIds.length === 0) {
      return {
        migratedBoardCount: 0,
        removedOwnerCollaboratorCount: 0
      }
    }

    const migratedBoardResult = await tx
      .update(boards)
      .set({
        creatorAnonymousId: '',
        creatorUserId: userId,
        updatedAt: now()
      })
      .where(eq(boards.creatorAnonymousId, anonymousId))
      .run()

    const removedOwnerCollaboratorResult = await tx
      .delete(collaborators)
      .where(
        and(
          inArray(collaborators.boardId, ownedBoardIds),
          eq(collaborators.anonymousId, anonymousId),
          eq(collaborators.role, 'owner')
        )
      )
      .run()

    return {
      migratedBoardCount: migratedBoardResult.rowsAffected,
      removedOwnerCollaboratorCount: removedOwnerCollaboratorResult.rowsAffected
    }
  })
}
