import type {
  AcceptDocumentInvitationInput,
  AcceptedInvitation,
  CreateDocumentInvitationInput,
  CreateInvitationContinuationInput,
  DocumentInvitation,
  InvitationPreview,
  WorkspaceRole
} from '#cloud/contract'
import { cloudInvitationURL } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError } from '#cloud/server/documents/errors'
import type { InvitationDelivery, InvitationOutbox } from '#cloud/server/invitations'
import type { Kysely } from 'kysely'

import { randomHex } from '@open-pencil/scene-graph/random'

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

const INVITATION_SECRET_BYTES = 24
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60_000

/** Workspace invitations share the invitation link; their ids are not document invitations. */
export type WorkspaceInvitationResolver = {
  preview(invitationId: string, token: string): Promise<InvitationPreview | null>
  accept(
    actor: CloudActor,
    invitationId: string,
    token: string
  ): Promise<{ workspaceId: string; role: WorkspaceRole } | null>
}

export type InvitationServiceOptions = {
  workspaceInvitations?: WorkspaceInvitationResolver
  continuationSecret?: string
  delivery?: InvitationDelivery
  outbox?: InvitationOutbox
  publicURL?: string
}

export function createInvitationService(
  database: Kysely<CloudDatabase>,
  options: InvitationServiceOptions
) {
  async function previewDocumentInvitation(
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
      .where('id', '=', invitation.invitedBy)
      .executeTakeFirst()
    return {
      kind: 'document',
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
        // Continuations are kept for document invitations only.
        async (invitationId, token) => previewDocumentInvitation(invitationId, { token })
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
      const token = randomHex(INVITATION_SECRET_BYTES)
      const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS)
      const deliveryContext =
        (options.delivery || options.outbox) && options.publicURL
          ? await Promise.all([
              database
                .selectFrom('user')
                .select('name')
                .where('id', '=', userId)
                .executeTakeFirst(),
              database
                .selectFrom('document')
                .select('name')
                .where('id', '=', documentId)
                .executeTakeFirstOrThrow()
            ])
          : null
      const acceptanceURL =
        deliveryContext && options.publicURL
          ? cloudInvitationURL(options.publicURL, id, token)
          : null
      const message =
        deliveryContext && acceptanceURL
          ? {
              deliveryId: id,
              recipientEmail: input.email,
              inviterName: deliveryContext[0]?.name ?? 'An OpenPencil user',
              documentName: deliveryContext[1].name,
              permission: input.permission,
              expiresAt: expiresAt.toISOString(),
              acceptanceURL
            }
          : null
      const row = await database.transaction().execute(async (transaction) => {
        const inserted = await transaction
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
        if (options.outbox && message) {
          await options.outbox.enqueueDocumentInvitation(message, transaction)
        }
        return inserted
      })
      const invitation = invitationContract(row)
      if (options.delivery && message && !options.outbox) {
        try {
          await options.delivery.sendDocumentInvitation(message)
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

    /** What an invitation link offers: a document, or a workspace when the id is one of those. */
    async previewInvitation(
      invitationId: string,
      input: AcceptDocumentInvitationInput
    ): Promise<InvitationPreview> {
      const workspace = await options.workspaceInvitations?.preview(invitationId, input.token)
      return workspace ?? previewDocumentInvitation(invitationId, input)
    },

    async acceptInvitation(
      actor: CloudActor,
      invitationId: string,
      input: AcceptDocumentInvitationInput
    ): Promise<AcceptedInvitation> {
      const workspace = await options.workspaceInvitations?.accept(actor, invitationId, input.token)
      if (workspace) return { kind: 'workspace', ...workspace }
      const invitation = await database
        .selectFrom('documentInvitation')
        .select([
          'id',
          'documentId',
          'emailNormalized',
          'permission',
          'invitedBy',
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
            // The grant is the inviter's, so "shared by" names them, not the recipient.
            createdBy: invitation.invitedBy,
            revokedAt: null
          })
          .onConflict((conflict) =>
            conflict.columns(['documentId', 'userId']).doUpdateSet({
              permission: invitation.permission,
              createdBy: invitation.invitedBy,
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
        return { kind: 'document' as const, grant: grantContract(row) }
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
