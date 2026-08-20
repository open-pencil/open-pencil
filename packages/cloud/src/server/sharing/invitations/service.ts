import type {
  AcceptDocumentInvitationInput,
  CreateDocumentInvitationInput,
  CreateInvitationContinuationInput,
  DocumentGrant,
  DocumentInvitation,
  InvitationPreview
} from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError } from '#cloud/server/documents/service'
import type { InvitationDelivery } from '#cloud/server/invitations'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import { nanoid } from 'nanoid'

import { requireSharingAccess } from '../access'
import {
  createInvitationContinuationService,
  invitationMatchesActor,
  invitationTokenIsActive,
  recipientHint
} from '../continuation'
import { dateString, grantContract, invitationContract } from '../contracts'
import { hashCapability } from '../crypto'
import { DocumentShareInvalidError, InvitationDeliveryError } from '../errors'

const INVITATION_SECRET_SIZE = 32
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60_000

export type InvitationServiceOptions = {
  continuationSecret?: string
  delivery?: InvitationDelivery
  publicURL?: string
  appURL?: string
}

export function createInvitationService(
  database: Kysely<CloudDatabase>,
  options: InvitationServiceOptions
) {
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
      const token = nanoid(INVITATION_SECRET_SIZE)
      const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS)
      const row = await database
        .insertInto('documentInvitation')
        .values({
          id,
          documentId,
          emailNormalized: input.email,
          permission: input.permission,
          tokenHash: hashCapability(token),
          invitedBy: userId,
          expiresAt,
          acceptedAt: null,
          revokedAt: null
        })
        .returning([
          'id',
          'documentId',
          'emailNormalized',
          'permission',
          'invitedBy',
          'invitedAt',
          'expiresAt',
          'acceptedAt'
        ])
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

export type InvitationService = ReturnType<typeof createInvitationService>
