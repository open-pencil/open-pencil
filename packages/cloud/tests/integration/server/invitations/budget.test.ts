import { describe, expect, test } from 'bun:test'

import { seedSharing } from '#cloud-tests/helpers/sharing'
import { INVITATION_BUDGET, InvitationLimitError } from '#cloud/server'

describe('invitation budget', () => {
  test('caps the invitations one address receives in a day', async () => {
    const context = await seedSharing()
    try {
      const invite = () =>
        context.sharing.createInvitation('owner', context.documentId, {
          email: 'target@example.com',
          permission: 'view'
        })
      for (let index = 0; index < INVITATION_BUDGET.perRecipient; index++) await invite()
      await expect(invite()).rejects.toBeInstanceOf(InvitationLimitError)
      // Someone else still gets theirs.
      await context.sharing.createInvitation('owner', context.documentId, {
        email: 'other@example.com',
        permission: 'view'
      })
    } finally {
      await context.runtime.close()
    }
  })

  test('caps the invitations one person sends in a day, counting workspaces too', async () => {
    const context = await seedSharing()
    try {
      const workspace = await context.runtime.database
        .selectFrom('document')
        .select('workspaceId')
        .where('id', '=', context.documentId)
        .executeTakeFirstOrThrow()
      await context.runtime.database
        .insertInto('workspaceInvitation')
        .values(
          Array.from({ length: INVITATION_BUDGET.perSender }, (_, index) => ({
            id: crypto.randomUUID(),
            workspaceId: workspace.workspaceId,
            emailNormalized: `person-${index}@example.com`,
            role: 'viewer' as const,
            tokenHash: crypto.randomUUID(),
            invitedBy: 'owner',
            expiresAt: new Date(Date.now() + 60_000),
            acceptedAt: null,
            revokedAt: null
          }))
        )
        .execute()
      await expect(
        context.sharing.createInvitation('owner', context.documentId, {
          email: 'one-more@example.com',
          permission: 'view'
        })
      ).rejects.toBeInstanceOf(InvitationLimitError)
    } finally {
      await context.runtime.close()
    }
  })
})
