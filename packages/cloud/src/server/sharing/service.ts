// Service composition intentionally remains colocated while capability, grant, and invitation
// transactional boundaries are extracted independently.
/* eslint-disable max-lines */
import type {
  AcceptDocumentInvitationInput,
  CloudUserProfile,
  CreateInvitationContinuationInput,
  CreateDocumentInvitationInput,
  CreateDocumentShareInput,
  DocumentGrant,
  DocumentInvitation,
  DocumentPermission,
  DocumentShare,
  InvitationPreview,
  LookupCloudUserInput,
  PutDocumentGrantInput,
  ResolveDocumentShareInput,
  UpdateDocumentShareInput
} from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError } from '#cloud/server/documents/service'
import type { InvitationDelivery } from '#cloud/server/invitations'
import { CLOUD_FEATURE_KEYS } from '#cloud/server/policy/keys'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import type { Kysely, UpdateObject } from 'kysely'
import { sql } from 'kysely'
import { nanoid } from 'nanoid'

import { requireSharingAccess } from './access'
import {
  createInvitationContinuationService,
  invitationMatchesActor,
  invitationTokenIsActive,
  recipientHint
} from './continuation'
import { dateString, grantContract, invitationContract, shareContract } from './contracts'
import { capabilityHashMatches, hashCapability } from './crypto'
import { DocumentShareInvalidError, InvitationDeliveryError } from './errors'
import { createSharingPolicy } from './policy'

const SHARE_SECRET_SIZE = 32
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60_000

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

export type DocumentSharingServiceOptions = {
  continuationSecret?: string
  delivery?: InvitationDelivery
  publicURL?: string
  appURL?: string
  policy?: CloudPolicy
  deploymentMode?: 'official' | 'self-hosted'
}

export function createDocumentSharingService(
  database: Kysely<CloudDatabase>,
  options: DocumentSharingServiceOptions = {}
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

  async function previewInvitation(
    invitationId: string,
    input: AcceptDocumentInvitationInput
  ): Promise<InvitationPreview> {
    const invitation = await database
      .selectFrom('documentInvitation')
      .innerJoin('document', 'document.id', 'documentInvitation.documentId')
      .select([
        'documentInvitation.emailNormalized',
        'documentInvitation.permission',
        'documentInvitation.tokenHash',
        'documentInvitation.expiresAt',
        'documentInvitation.acceptedAt',
        'documentInvitation.revokedAt',
        'documentInvitation.invitedBy',
        'document.name as documentName'
      ])
      .where('documentInvitation.id', '=', invitationId)
      .executeTakeFirst()
    if (!invitation || !invitationTokenIsActive(invitation, input.token)) {
      throw new DocumentShareInvalidError()
    }
    const inviter = await database
      .selectFrom('user')
      .select('name')
      .where(sql<string>`id::text`, '=', invitation.invitedBy)
      .executeTakeFirst()
    return {
      documentName: invitation.documentName,
      inviterName: inviter?.name ?? 'An OpenPencil user',
      permission: invitation.permission,
      expiresAt: dateString(invitation.expiresAt) ?? '',
      recipientHint: recipientHint(invitation.emailNormalized)
    }
  }

  const continuation = options.continuationSecret
    ? createInvitationContinuationService(
        database,
        options.continuationSecret,
        async (invitationId, token) => previewInvitation(invitationId, { token })
      )
    : null

  return {
    async lookupUser(
      userId: string,
      documentId: string,
      input: LookupCloudUserInput
    ): Promise<CloudUserProfile | null> {
      await requireSharingAccess(database, userId, documentId)
      const user = await database
        .selectFrom('user')
        .select(['id', 'name', 'email', 'image'])
        .where(sql<string>`lower(email)`, '=', input.email)
        .executeTakeFirst()
      return user ?? null
    },

    async userProfile(
      userId: string,
      documentId: string,
      profileUserId: string
    ): Promise<CloudUserProfile | null> {
      await requireSharingAccess(database, userId, documentId)
      return (
        (await database
          .selectFrom('user')
          .select(['id', 'name', 'email', 'image'])
          .where('id', '=', profileUserId)
          .executeTakeFirst()) ?? null
      )
    },

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
        const created = await transaction
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
        return created
      })
      return { share: shareContract(row), secret, path: `/share/${id}#${secret}` }
    },

    async updateShare(
      userId: string,
      documentId: string,
      shareId: string,
      input: UpdateDocumentShareInput
    ): Promise<DocumentShare> {
      const permission = input.permission
        ? input.permission
        : await database
            .selectFrom('documentShare')
            .select('permission')
            .where('id', '=', shareId)
            .where('documentId', '=', documentId)
            .where('revokedAt', 'is', null)
            .executeTakeFirstOrThrow()
            .then((share) => share.permission)
      await sharingPolicy.requireCapabilityLink({ actorId: userId, documentId, permission })
      const row = await updateActiveShare(userId, documentId, shareId, {
        ...(input.permission ? { permission: input.permission } : {}),
        ...(input.expiresAt !== undefined
          ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
          : {}),
        updatedAt: new Date()
      })
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
        const policyDocument = await database
          .selectFrom('document')
          .select('workspaceId')
          .where('id', '=', row.documentId)
          .executeTakeFirstOrThrow()
        const context = {
          targetingKey: policyDocument.workspaceId,
          workspaceId: policyDocument.workspaceId,
          documentId: row.documentId,
          deploymentMode: options.deploymentMode ?? ('self-hosted' as const)
        }
        const featureKey =
          row.permission === 'edit'
            ? CLOUD_FEATURE_KEYS.anonymousEdit
            : CLOUD_FEATURE_KEYS.anonymousView
        if (!(await options.policy.boolean(featureKey, false, context))) {
          throw new DocumentShareInvalidError()
        }
      }
      await database
        .updateTable('documentShare')
        .set({ lastUsedAt: new Date() })
        .where('id', '=', shareId)
        .execute()
      const principal: ResolvedSharePrincipal = actor
        ? { kind: 'user', userId: actor.userId, name: actor.name, email: actor.email }
        : {
            kind: 'guest',
            guestId: input.guestId ?? nanoid(),
            name: input.guestName ?? 'Guest'
          }
      return {
        documentId: row.documentId,
        permission: row.permission,
        principal,
        roomEpoch: row.roomEpoch
      }
    },

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
    },

    async listInvitations(userId: string, documentId: string): Promise<DocumentInvitation[]> {
      await requireSharingAccess(database, userId, documentId)
      const rows = await database
        .selectFrom('documentInvitation')
        .select([
          'id',
          'documentId',
          'emailNormalized',
          'permission',
          'invitedBy',
          'invitedAt',
          'expiresAt',
          'acceptedAt'
        ])
        .where('documentId', '=', documentId)
        .where('revokedAt', 'is', null)
        .orderBy('invitedAt')
        .execute()
      return rows.map(invitationContract)
    },

    async createInvitation(
      userId: string,
      documentId: string,
      input: CreateDocumentInvitationInput
    ): Promise<{ invitation: DocumentInvitation; token: string }> {
      await requireSharingAccess(database, userId, documentId)
      const id = crypto.randomUUID()
      const token = nanoid(SHARE_SECRET_SIZE)
      await database
        .insertInto('documentInvitation')
        .values({
          id,
          documentId,
          emailNormalized: input.email,
          permission: input.permission,
          tokenHash: hashCapability(token),
          invitedBy: userId,
          expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS),
          acceptedAt: null,
          revokedAt: null
        })
        .execute()
      const row = await database
        .selectFrom('documentInvitation')
        .select([
          'id',
          'documentId',
          'emailNormalized',
          'permission',
          'invitedBy',
          'invitedAt',
          'expiresAt',
          'acceptedAt'
        ])
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
      const invitation = invitationContract(row)
      if (options.delivery && options.publicURL && options.appURL) {
        const [inviter, document] = await Promise.all([
          database.selectFrom('user').select('name').where('id', '=', userId).executeTakeFirst(),
          database
            .selectFrom('document')
            .select('name')
            .where('id', '=', documentId)
            .executeTakeFirstOrThrow()
        ])
        const acceptanceURL = new URL(
          `/cloud/invitations/${id}?server=${encodeURIComponent(options.publicURL)}#${token}`,
          options.appURL
        ).href
        try {
          await options.delivery.sendDocumentInvitation({
            deliveryId: id,
            recipientEmail: invitation.email,
            inviterName: inviter?.name ?? 'An OpenPencil user',
            documentName: document.name,
            permission: invitation.permission,
            expiresAt: invitation.expiresAt,
            acceptanceURL
          })
        } catch (error) {
          await database
            .updateTable('documentInvitation')
            .set({ revokedAt: new Date() })
            .where('id', '=', id)
            .execute()
          throw new InvitationDeliveryError('Invitation delivery failed', { cause: error })
        }
      }
      return { invitation, token }
    },

    async createInvitationContinuation(input: CreateInvitationContinuationInput) {
      if (!continuation) throw new DocumentShareInvalidError()
      return continuation.create(input)
    },

    async consumeInvitationContinuation(id: string) {
      if (!continuation) throw new DocumentShareInvalidError()
      return continuation.consume(id)
    },

    previewInvitation,

    async acceptInvitation(
      actor: CloudActor,
      invitationId: string,
      input: AcceptDocumentInvitationInput
    ): Promise<DocumentGrant> {
      const invitation = await database
        .selectFrom('documentInvitation')
        .select([
          'id',
          'documentId',
          'emailNormalized',
          'permission',
          'tokenHash',
          'expiresAt',
          'acceptedAt',
          'revokedAt'
        ])
        .where('id', '=', invitationId)
        .executeTakeFirst()
      if (
        !invitation ||
        !invitationMatchesActor(actor, invitation.emailNormalized) ||
        !invitationTokenIsActive(invitation, input.token)
      ) {
        throw new DocumentShareInvalidError()
      }
      return database.transaction().execute(async (transaction) => {
        const row = await transaction
          .insertInto('documentGrant')
          .values({
            id: crypto.randomUUID(),
            documentId: invitation.documentId,
            userId: actor.userId,
            permission: invitation.permission,
            createdBy: actor.userId,
            revokedAt: null
          })
          .onConflict((conflict) =>
            conflict.columns(['documentId', 'userId']).doUpdateSet({
              permission: invitation.permission,
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
        await transaction
          .updateTable('documentInvitation')
          .set({ acceptedAt: new Date() })
          .where('id', '=', invitationId)
          .where('acceptedAt', 'is', null)
          .execute()
        return grantContract(row)
      })
    },

    async revokeInvitation(
      userId: string,
      documentId: string,
      invitationId: string
    ): Promise<void> {
      await requireSharingAccess(database, userId, documentId)
      const result = await database
        .updateTable('documentInvitation')
        .set({ revokedAt: new Date() })
        .where('id', '=', invitationId)
        .where('documentId', '=', documentId)
        .where('revokedAt', 'is', null)
        .executeTakeFirst()
      if (Number(result.numUpdatedRows) === 0) throw new DocumentNotFoundError()
    }
  }
}

export type DocumentSharingService = ReturnType<typeof createDocumentSharingService>
