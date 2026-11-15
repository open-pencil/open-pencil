import type { CloudDatabase } from '#cloud/server/db'
import { lockForTransaction } from '#cloud/server/db/expressions'
import type { Transaction } from 'kysely'

/**
 * How many invitations, to documents and workspaces alike, one person may send in a day, and how
 * many one address may receive from everyone. Each sends an email naming the inviter and the file,
 * both of which the sender chooses, so without a daily budget invitations are a way to send spam.
 */
export const INVITATION_BUDGET = {
  windowMs: 24 * 60 * 60 * 1000,
  perSender: 100,
  perRecipient: 5
} as const

/** An invitation past the sender's or the recipient's daily budget. */
export class InvitationLimitError extends Error {
  override readonly name = 'InvitationLimitError'
}

async function sentSince(
  transaction: Transaction<CloudDatabase>,
  column: 'senderId' | 'emailNormalized',
  value: string,
  since: Date
): Promise<number> {
  const row = await transaction
    .selectFrom('invitationSend')
    .select((expression) => expression.fn.countAll<string>().as('count'))
    .where(column, '=', value)
    .where('sentAt', '>', since)
    .executeTakeFirstOrThrow()
  return Number(row.count)
}

/**
 * Counts an invitation from `senderId` to `email` against both daily budgets, in the transaction
 * that creates it, or refuses it once either budget is used. Sends are logged apart from the
 * invitations, so deleting a workspace or document gives nothing back, and the check holds locks
 * on the sender and the recipient, so two invitations at once cannot both take the last one.
 */
export async function spendInvitationBudget(
  transaction: Transaction<CloudDatabase>,
  invitation: { senderId: string; email: string },
  now = new Date()
): Promise<void> {
  const email = invitation.email.trim().toLowerCase()
  // Always sender first, then recipient, so two transactions never wait on each other in turn.
  await lockForTransaction(transaction, `invitation-sender:${invitation.senderId}`)
  await lockForTransaction(transaction, `invitation-recipient:${email}`)
  const since = new Date(now.getTime() - INVITATION_BUDGET.windowMs)
  const bySender = await sentSince(transaction, 'senderId', invitation.senderId, since)
  const byRecipient = await sentSince(transaction, 'emailNormalized', email, since)
  if (bySender >= INVITATION_BUDGET.perSender || byRecipient >= INVITATION_BUDGET.perRecipient) {
    throw new InvitationLimitError()
  }
  await transaction
    .insertInto('invitationSend')
    .values({
      id: crypto.randomUUID(),
      senderId: invitation.senderId,
      emailNormalized: email,
      sentAt: now
    })
    .execute()
}
