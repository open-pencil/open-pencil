import type { DocumentGrant, PutDocumentGrantInput } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError } from '#cloud/server/documents/service'
import type { Kysely } from 'kysely'

import { requireSharingAccess } from '../access'
import { grantContract } from '../contracts'

export function createGrantService(database: Kysely<CloudDatabase>) {
  return {
    async listGrants(userId: string, documentId: string): Promise<DocumentGrant[]> {
      await requireSharingAccess(database, userId, documentId)
      const rows = await database
        .selectFrom('documentGrant')
        .select(['id', 'documentId', 'userId', 'permission', 'createdBy', 'createdAt', 'updatedAt'])
        .where('documentId', '=', documentId)
        .where('revokedAt', 'is', null)
        .orderBy('createdAt')
        .execute()
      return rows.map(grantContract)
    },

    async putGrant(
      userId: string,
      documentId: string,
      targetUserId: string,
      input: PutDocumentGrantInput
    ): Promise<DocumentGrant> {
      await requireSharingAccess(database, userId, documentId)
      const row = await database
        .insertInto('documentGrant')
        .values({
          id: crypto.randomUUID(),
          documentId,
          userId: targetUserId,
          permission: input.permission,
          createdBy: userId,
          revokedAt: null
        })
        .onConflict((conflict) =>
          conflict.columns(['documentId', 'userId']).doUpdateSet({
            permission: input.permission,
            createdBy: userId,
            revokedAt: null,
            updatedAt: new Date()
          })
        )
        .returning([
          'id',
          'documentId',
          'userId',
          'permission',
          'createdBy',
          'createdAt',
          'updatedAt'
        ])
        .executeTakeFirstOrThrow()
      return grantContract(row)
    },

    async revokeGrant(userId: string, documentId: string, targetUserId: string): Promise<void> {
      await requireSharingAccess(database, userId, documentId)
      const result = await database
        .updateTable('documentGrant')
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where('documentId', '=', documentId)
        .where('userId', '=', targetUserId)
        .where('revokedAt', 'is', null)
        .executeTakeFirst()
      if (Number(result.numUpdatedRows) === 0) throw new DocumentNotFoundError()
    }
  }
}

export type GrantService = ReturnType<typeof createGrantService>
