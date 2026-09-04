import type {
  CreateDocumentShareInput,
  DocumentPermission,
  DocumentShare,
  ResolveDocumentShareInput,
  UpdateDocumentShareInput
} from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError } from '#cloud/server/documents/service'
import { CLOUD_FEATURE_KEYS } from '#cloud/server/policy/keys'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import type { Kysely, UpdateObject } from 'kysely'
import { nanoid } from 'nanoid'

import { requireSharingAccess } from '../access'
import { shareContract } from '../contracts'
import { capabilityHashMatches, hashCapability } from '../crypto'
import { DocumentShareInvalidError } from '../errors'
import { createSharingPolicy } from '../policy'

const SHARE_SECRET_SIZE = 32

export type DocumentShareCapability = {
  share: DocumentShare
  secret: string
  path: string
}

export type ResolvedSharePrincipal =
  | { kind: 'user'; userId: string; name: string; email: string }
  | { kind: 'guest'; guestId: string; name: string }

export type ResolvedDocumentShare = {
  documentId: string
  permission: DocumentPermission
  principal: ResolvedSharePrincipal
  roomEpoch: number
}

export type CapabilityServiceOptions = {
  policy?: CloudPolicy
  deploymentMode?: 'official' | 'self-hosted'
}

export function createCapabilityService(
  database: Kysely<CloudDatabase>,
  options: CapabilityServiceOptions
) {
  const sharingPolicy = createSharingPolicy(database, options)

  async function updateActiveShare(
    userId: string,
    documentId: string,
    shareId: string,
    changes: UpdateObject<CloudDatabase, 'documentShare'>
  ) {
    await requireSharingAccess(database, userId, documentId)
    const row = await database
      .updateTable('documentShare')
      .set(changes)
      .where('id', '=', shareId)
      .where('documentId', '=', documentId)
      .where('revokedAt', 'is', null)
      .returningAll()
      .executeTakeFirst()
    if (!row) throw new DocumentNotFoundError()
    return row
  }

  return {
    async listShares(userId: string, documentId: string): Promise<DocumentShare[]> {
      await requireSharingAccess(database, userId, documentId)
      const rows = await database
        .selectFrom('documentShare')
        .selectAll()
        .where('documentId', '=', documentId)
        .where('revokedAt', 'is', null)
        .orderBy('createdAt', 'desc')
        .execute()
      return rows.map(shareContract)
    },

    async createShare(
      userId: string,
      documentId: string,
      input: CreateDocumentShareInput
    ): Promise<DocumentShareCapability> {
      await requireSharingAccess(database, userId, documentId)
      await sharingPolicy.requireCapabilityLink({
        actorId: userId,
        documentId,
        permission: input.permission
      })
      const id = crypto.randomUUID()
      const secret = nanoid(SHARE_SECRET_SIZE)
      const row = await database.transaction().execute(async (transaction) => {
        const document = await transaction
          .selectFrom('document')
          .select('collaborationEpoch')
          .where('id', '=', documentId)
          .forUpdate()
          .executeTakeFirstOrThrow()
        return transaction
          .insertInto('documentShare')
          .values({
            id,
            documentId,
            permission: input.permission,
            secretHash: hashCapability(secret),
            roomEpoch: document.collaborationEpoch,
            createdBy: userId,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            revokedAt: null,
            lastUsedAt: null
          })
          .returningAll()
          .executeTakeFirstOrThrow()
      })
      return { share: shareContract(row), secret, path: `/share/${id}#${secret}` }
    },

    async updateShare(
      userId: string,
      documentId: string,
      shareId: string,
      input: UpdateDocumentShareInput
    ): Promise<DocumentShare> {
      const permission =
        input.permission ??
        (
          await database
            .selectFrom('documentShare')
            .select('permission')
            .where('id', '=', shareId)
            .where('documentId', '=', documentId)
            .where('revokedAt', 'is', null)
            .executeTakeFirstOrThrow()
        ).permission
      await sharingPolicy.requireCapabilityLink({ actorId: userId, documentId, permission })
      const changes: UpdateObject<CloudDatabase, 'documentShare'> = { updatedAt: new Date() }
      if (input.permission) changes.permission = input.permission
      if (input.expiresAt !== undefined) {
        changes.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
      }
      const row = await updateActiveShare(userId, documentId, shareId, changes)
      return shareContract(row)
    },

    async rotateShare(
      userId: string,
      documentId: string,
      shareId: string
    ): Promise<DocumentShareCapability> {
      const secret = nanoid(SHARE_SECRET_SIZE)
      const row = await database.transaction().execute(async (transaction) => {
        await requireSharingAccess(transaction, userId, documentId)
        const document = await transaction
          .selectFrom('document')
          .select('collaborationEpoch')
          .where('id', '=', documentId)
          .forUpdate()
          .executeTakeFirstOrThrow()
        const updated = await transaction
          .updateTable('documentShare')
          .set({
            secretHash: hashCapability(secret),
            roomEpoch: document.collaborationEpoch,
            updatedAt: new Date()
          })
          .where('id', '=', shareId)
          .where('documentId', '=', documentId)
          .where('revokedAt', 'is', null)
          .returningAll()
          .executeTakeFirst()
        if (!updated) throw new DocumentNotFoundError()
        return updated
      })
      return { share: shareContract(row), secret, path: `/share/${shareId}#${secret}` }
    },

    async revokeShare(userId: string, documentId: string, shareId: string): Promise<void> {
      await database.transaction().execute(async (transaction) => {
        await requireSharingAccess(transaction, userId, documentId)
        const result = await transaction
          .updateTable('documentShare')
          .set({ revokedAt: new Date(), updatedAt: new Date() })
          .where('id', '=', shareId)
          .where('documentId', '=', documentId)
          .where('revokedAt', 'is', null)
          .executeTakeFirst()
        if (Number(result.numUpdatedRows) === 0) throw new DocumentNotFoundError()
        await transaction
          .updateTable('document')
          .set({ collaborationEpoch: (expression) => expression('collaborationEpoch', '+', 1) })
          .where('id', '=', documentId)
          .executeTakeFirst()
      })
    },

    async resolveShare(
      shareId: string,
      input: ResolveDocumentShareInput,
      actor?: CloudActor
    ): Promise<ResolvedDocumentShare> {
      const row = await database
        .selectFrom('documentShare')
        .innerJoin('document', 'document.id', 'documentShare.documentId')
        .select([
          'documentShare.id',
          'documentShare.documentId',
          'documentShare.permission',
          'documentShare.secretHash',
          'documentShare.roomEpoch',
          'documentShare.expiresAt'
        ])
        .where('documentShare.id', '=', shareId)
        .where('documentShare.revokedAt', 'is', null)
        .where('document.deletedAt', 'is', null)
        .executeTakeFirst()
      if (
        !row ||
        !capabilityHashMatches(row.secretHash, input.secret) ||
        (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now())
      ) {
        throw new DocumentShareInvalidError()
      }
      if (!actor && options.policy) {
        const document = await database
          .selectFrom('document')
          .select('workspaceId')
          .where('id', '=', row.documentId)
          .executeTakeFirstOrThrow()
        const featureKey =
          row.permission === 'edit'
            ? CLOUD_FEATURE_KEYS.anonymousEdit
            : CLOUD_FEATURE_KEYS.anonymousView
        if (
          !(await options.policy.boolean(featureKey, false, {
            targetingKey: document.workspaceId,
            workspaceId: document.workspaceId,
            documentId: row.documentId,
            deploymentMode: options.deploymentMode ?? 'self-hosted'
          }))
        ) {
          throw new DocumentShareInvalidError()
        }
      }
      await database
        .updateTable('documentShare')
        .set({ lastUsedAt: new Date() })
        .where('id', '=', shareId)
        .execute()
      return {
        documentId: row.documentId,
        permission: row.permission,
        principal: actor
          ? { kind: 'user', userId: actor.userId, name: actor.name, email: actor.email }
          : {
              kind: 'guest',
              guestId: input.guestId ?? nanoid(),
              name: input.guestName ?? 'Guest'
            },
        roomEpoch: row.roomEpoch
      }
    }
  }
}

export type CapabilityService = ReturnType<typeof createCapabilityService>
