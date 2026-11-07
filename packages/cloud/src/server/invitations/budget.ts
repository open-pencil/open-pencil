import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely, Transaction } from 'kysely'

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

type Executor = Kysely<CloudDatabase> | Transaction<CloudDatabase>

/** Invitations sent since `since` that `column` matches, to documents and workspaces together. */
async function sentSince(
  executor: Executor,
  column: 'invitedBy' | 'emailNormalized',
  value: string,
  since: Date
): Promise<number> {
  const [documents, workspaces] = await Promise.all([
    executor
      .selectFrom('documentInvitation')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where(column, '=', value)
      .where('invitedAt', '>', since)
      .executeTakeFirstOrThrow(),
    executor
      .selectFrom('workspaceInvitation')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where(column, '=', value)
      .where('invitedAt', '>', since)
      .executeTakeFirstOrThrow()
  ])
  return Number(documents.count) + Number(workspaces.count)
}

/** Refuses another invitation from `senderId` to `email` once either has used its day's budget. */
export async function assertInvitationBudget(
  executor: Executor,
  invitation: { senderId: string; email: string },
  now = new Date()
): Promise<void> {
  const since = new Date(now.getTime() - INVITATION_BUDGET.windowMs)
  const [bySender, byRecipient] = await Promise.all([
    sentSince(executor, 'invitedBy', invitation.senderId, since),
    sentSince(executor, 'emailNormalized', invitation.email.trim().toLowerCase(), since)
  ])
  if (bySender >= INVITATION_BUDGET.perSender || byRecipient >= INVITATION_BUDGET.perRecipient) {
    throw new InvitationLimitError()
  }
}
