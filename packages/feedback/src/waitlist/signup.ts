import type { WaitlistSignup } from '#feedback/contract'
import type { FeedbackDatabase } from '#feedback/db'
import type { Kysely } from 'kysely'

import { randomHex } from '@lawha/scene-graph/random'

/** How long before a repeated sign-up sends another confirmation email. */
const RESEND_AFTER_MS = 10 * 60 * 1000
/** How long an unconfirmed sign-up is kept. */
export const UNCONFIRMED_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Records a sign-up and returns the token to email, or `null` when no email should go out: the
 * address is already confirmed or was sent a confirmation moments ago.
 */
export async function signUp(
  db: Kysely<FeedbackDatabase>,
  { email, note }: Pick<WaitlistSignup, 'email' | 'note'>,
  now: Date
): Promise<string | null> {
  const emailKey = email.toLowerCase()
  const sentAt = now.toISOString()
  const existing = await db
    .selectFrom('waitlist')
    .select(['token', 'confirmedAt', 'confirmationSentAt'])
    .where('emailKey', '=', emailKey)
    .executeTakeFirst()
  if (existing) {
    if (existing.confirmedAt) return null
    if (now.getTime() - Date.parse(existing.confirmationSentAt) < RESEND_AFTER_MS) return null
    await db
      .updateTable('waitlist')
      .set({ confirmationSentAt: sentAt, ...(note ? { note } : {}) })
      .where('emailKey', '=', emailKey)
      .execute()
    return existing.token
  }
  const token = randomHex(32)
  const inserted = await db
    .insertInto('waitlist')
    .values({
      email,
      emailKey,
      note: note || null,
      token,
      createdAt: sentAt,
      confirmationSentAt: sentAt
    })
    .onConflict((conflict) => conflict.column('emailKey').doNothing())
    .executeTakeFirst()
  return inserted.numInsertedOrUpdatedRows ? token : null
}

export async function confirmSignup(
  db: Kysely<FeedbackDatabase>,
  token: string,
  now: Date
): Promise<boolean> {
  const result = await db
    .updateTable('waitlist')
    .set((eb) => ({ confirmedAt: eb.fn.coalesce('confirmedAt', eb.val(now.toISOString())) }))
    .where('token', '=', token)
    .executeTakeFirst()
  return result.numUpdatedRows > 0n
}

export async function leaveWaitlist(db: Kysely<FeedbackDatabase>, token: string): Promise<void> {
  await db.deleteFrom('waitlist').where('token', '=', token).execute()
}

/** Removes sign-ups nobody confirmed within `UNCONFIRMED_TTL_MS`. */
export async function deleteUnconfirmedSignups(
  db: Kysely<FeedbackDatabase>,
  now: Date
): Promise<void> {
  const cutoff = new Date(now.getTime() - UNCONFIRMED_TTL_MS).toISOString()
  await db
    .deleteFrom('waitlist')
    .where('confirmedAt', 'is', null)
    .where('createdAt', '<', cutoff)
    .execute()
}
