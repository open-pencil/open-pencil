import type { DocumentPermission } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentShareInvalidError } from '#cloud/server/sharing/errors'
import type { Kysely } from 'kysely'
import { nanoid } from 'nanoid'

import { capabilityHashMatches, decryptContinuationToken, encryptContinuationToken } from './crypto'

const CONTINUATION_LIFETIME_MS = 10 * 60_000

export type InvitationContinuationService = ReturnType<typeof createInvitationContinuationService>

export function createInvitationContinuationService(
  database: Kysely<CloudDatabase>,
  secret: string,
  validateInvitation: (
    invitationId: string,
    token: string
  ) => Promise<{
    documentName: string
    inviterName: string
    permission: DocumentPermission
    expiresAt: string
    recipientHint: string
  }>
) {
  return {
    async create(input: { invitationId: string; token: string }): Promise<{ id: string }> {
      await validateInvitation(input.invitationId, input.token)
      const id = nanoid()
      await database
        .insertInto('invitationContinuation')
        .values({
          id,
          invitationId: input.invitationId,
          tokenEncrypted: await encryptContinuationToken(secret, input.token),
          expiresAt: new Date(Date.now() + CONTINUATION_LIFETIME_MS),
          consumedAt: null
        })
        .execute()
      return { id }
    },

    async consume(id: string): Promise<{ invitationId: string; token: string }> {
      return database.transaction().execute(async (transaction) => {
        const row = await transaction
          .selectFrom('invitationContinuation')
          .select(['invitationId', 'tokenEncrypted', 'expiresAt', 'consumedAt'])
          .where('id', '=', id)
          .forUpdate()
          .executeTakeFirst()
        if (!row || row.consumedAt || new Date(row.expiresAt).getTime() <= Date.now()) {
          throw new DocumentShareInvalidError()
        }
        await transaction
          .updateTable('invitationContinuation')
          .set({ consumedAt: new Date() })
          .where('id', '=', id)
          .execute()
        return {
          invitationId: row.invitationId,
          token: await decryptContinuationToken(secret, row.tokenEncrypted)
        }
      })
    }
  }
}

export function invitationTokenIsActive(
  invitation: {
    tokenHash: string
    expiresAt: Date | string
    acceptedAt: Date | string | null
    revokedAt: Date | string | null
  },
  token: string
): boolean {
  return (
    capabilityHashMatches(invitation.tokenHash, token) &&
    !invitation.acceptedAt &&
    !invitation.revokedAt &&
    new Date(invitation.expiresAt).getTime() > Date.now()
  )
}

export function recipientHint(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`
}

export function invitationMatchesActor(actor: CloudActor, email: string): boolean {
  return email === actor.email.trim().toLowerCase()
}
