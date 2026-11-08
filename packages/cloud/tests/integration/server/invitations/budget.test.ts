import { describe, expect, test } from 'bun:test'

import { seedSharing } from '#cloud-tests/helpers/sharing'
import { INVITATION_BUDGET, InvitationLimitError } from '#cloud/server'

type Context = Awaited<ReturnType<typeof seedSharing>>

const invite = (context: Context, email: string) =>
  context.sharing.createInvitation('owner', context.documentId, { email, permission: 'view' })

/** Logs sends as earlier invitations would have, `ageMs` ago. */
async function logSends(
  context: Context,
  sends: { senderId: string; email: string }[],
  ageMs = 0
): Promise<void> {
  await context.runtime.database
    .insertInto('invitationSend')
    .values(
      sends.map((send) => ({
        id: crypto.randomUUID(),
        senderId: send.senderId,
        emailNormalized: send.email,
        sentAt: new Date(Date.now() - ageMs)
      }))
    )
    .execute()
}

describe('invitation budget', () => {
  test('caps the invitations one address receives in a day, in any letter case', async () => {
    const context = await seedSharing()
    try {
      for (let index = 0; index < INVITATION_BUDGET.perRecipient; index++) {
        await invite(context, index % 2 === 0 ? 'target@example.com' : 'Target@Example.com')
      }
      await expect(invite(context, 'TARGET@example.com')).rejects.toBeInstanceOf(
        InvitationLimitError
      )
      // Someone else still gets theirs.
      await invite(context, 'other@example.com')
    } finally {
      await context.runtime.close()
    }
  })

  test('caps the invitations one person sends in a day', async () => {
    const context = await seedSharing()
    try {
      await logSends(
        context,
        Array.from({ length: INVITATION_BUDGET.perSender }, (_, index) => ({
          senderId: 'owner',
          email: `person-${index}@example.com`
        }))
      )
      await expect(invite(context, 'one-more@example.com')).rejects.toBeInstanceOf(
        InvitationLimitError
      )
    } finally {
      await context.runtime.close()
    }
  })

  test('gives the budget back once a day has passed', async () => {
    const context = await seedSharing()
    try {
      const dayAndMinute = INVITATION_BUDGET.windowMs + 60_000
      await logSends(
        context,
        Array.from({ length: INVITATION_BUDGET.perSender }, (_, index) => ({
          senderId: 'owner',
          email: index < INVITATION_BUDGET.perRecipient ? 'target@example.com' : `p-${index}@x.com`
        })),
        dayAndMinute
      )
      await invite(context, 'target@example.com')
    } finally {
      await context.runtime.close()
    }
  })

  test('refuses all but one of the invitations sent at once for the last of the budget', async () => {
    const context = await seedSharing()
    try {
      await logSends(
        context,
        Array.from({ length: INVITATION_BUDGET.perRecipient - 1 }, () => ({
          senderId: 'someone-else',
          email: 'target@example.com'
        }))
      )
      const results = await Promise.allSettled(
        Array.from({ length: 4 }, () => invite(context, 'target@example.com'))
      )
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    } finally {
      await context.runtime.close()
    }
  })
})
