import type {
  CreateDocumentShareInput,
  DocumentPermission,
  DocumentShare,
  ResolveDocumentShareInput,
  UpdateDocumentShareInput
} from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError } from '#cloud/server/documents/errors'
import { CLOUD_FEATURE_KEYS } from '#cloud/server/policy/keys'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import { workspacePolicyContext } from '#cloud/server/policy/workspace'
import type { Kysely, UpdateObject } from 'kysely'
import * as v from 'valibot'

import { randomHex } from '@open-pencil/scene-graph/random'

import { advanceCollaborationEpoch, requireSharingAccess } from '../access'
import { shareContract } from '../contracts'
import { capabilityHashMatches, hashCapability } from '../crypto'
import { DocumentShareInvalidError, DocumentShareSignInRequiredError } from '../errors'
import { createSharingPolicy } from '../policy'

const SHARE_SECRET_BYTES = 24

/** An account ID as the user table keys it; other IDs in `createdBy` name no account. */
const accountIdSchema = v.pipe(v.string(), v.uuid())

/**
 * Whether any of these people is banned, for a ban that has not run out. A link stops working
 * while whoever made it, or made its document, is banned, so what a banned person put up is no
 * longer public. The IDs are matched as the user table keys them, so the lookup uses its index.
 */
async function anyBanned(database: Kysely<CloudDatabase>, userIds: string[]): Promise<boolean> {
  const accounts = userIds.filter((id) => v.is(accountIdSchema, id))
  if (accounts.length === 0) return false
  const banned = await database
    .selectFrom('user')
    .select('id')
    .where('id', 'in', accounts)
    .where('banned', '=', true)
    .where((user) => user.or([user('banExpires', 'is', null), user('banExpires', '>', new Date())]))
    .executeTakeFirst()
  return banned !== undefined
}

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
  /** What this person may do: the link's permission, or view for a guest who may not edit. */
  permission: DocumentPermission
  /** What the link lets someone signed in to the server do. */
  linkPermission: DocumentPermission
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

  /**
   * What a guest may do through a link: edit only where guests may edit, otherwise view where
   * guests may view, so an edit link still shows the document to someone not signed in. `null`
   * means the guest signs in first. Without a policy, guests get the link's own permission.
   */
  async function guestPermission(
    documentId: string,
    linkPermission: DocumentPermission
  ): Promise<DocumentPermission | null> {
    const policy = options.policy
    if (!policy) return linkPermission
    // A workspace takes its owner's plan.
    const context = await workspacePolicyContext(
      database,
      { documentId },
      { deploymentMode: options.deploymentMode ?? 'self-hosted' }
    )
    if (!context) return null
    if (
      linkPermission === 'edit' &&
      (await policy.boolean(CLOUD_FEATURE_KEYS.guestEdit, false, context))
    ) {
      return 'edit'
    }
    return (await policy.boolean(CLOUD_FEATURE_KEYS.guestView, false, context)) ? 'view' : null
  }

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
      await sharingPolicy.requireCapabilityLink({ actorId: userId, documentId })
      const id = crypto.randomUUID()
      const secret = randomHex(SHARE_SECRET_BYTES)
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
      // Authorization comes first, so a caller without access learns nothing about the share
      // or the document's link policy.
      await requireSharingAccess(database, userId, documentId)
      const current = await database
        .selectFrom('documentShare')
        .select('id')
        .where('id', '=', shareId)
        .where('documentId', '=', documentId)
        .where('revokedAt', 'is', null)
        .executeTakeFirst()
      if (!current) throw new DocumentNotFoundError()
      await sharingPolicy.requireCapabilityLink({ actorId: userId, documentId })
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
      const secret = randomHex(SHARE_SECRET_BYTES)
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
        await advanceCollaborationEpoch(transaction, documentId)
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
          'documentShare.expiresAt',
          'documentShare.createdBy as linkMaker',
          'document.createdBy as documentMaker'
        ])
        .where('documentShare.id', '=', shareId)
        .where('documentShare.revokedAt', 'is', null)
        .where('document.deletedAt', 'is', null)
        .executeTakeFirst()
      if (
        !row ||
        !capabilityHashMatches(row.secretHash, input.secret) ||
        (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) ||
        (await anyBanned(database, [row.linkMaker, row.documentMaker]))
      ) {
        throw new DocumentShareInvalidError()
      }
      const permission = actor
        ? row.permission
        : await guestPermission(row.documentId, row.permission)
      if (!permission) {
        // Guests are not let in here; people signed in to the server are.
        throw new DocumentShareSignInRequiredError()
      }
      await database
        .updateTable('documentShare')
        .set({ lastUsedAt: new Date() })
        .where('id', '=', shareId)
        .execute()
      return {
        documentId: row.documentId,
        permission,
        linkPermission: row.permission,
        principal: actor
          ? { kind: 'user', userId: actor.userId, name: actor.name, email: actor.email }
          : {
              kind: 'guest',
              guestId: input.guestId ?? crypto.randomUUID(),
              name: input.guestName ?? 'Guest'
            },
        roomEpoch: row.roomEpoch
      }
    }
  }
}

export type CapabilityService = ReturnType<typeof createCapabilityService>
