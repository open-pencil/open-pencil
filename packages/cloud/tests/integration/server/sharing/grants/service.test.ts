import { describe, expect, test } from 'bun:test'

import { seedSharing } from '#cloud-tests/helpers/sharing'
import { DocumentShareInvalidError } from '#cloud/server'

describe('document sharing grants integration', () => {
  test('manages direct grants', async () => {
    const context = await seedSharing()
    try {
      const grant = await context.sharing.putGrant('owner', context.documentId, 'outside-user', {
        permission: 'view'
      })
      expect(grant).toMatchObject({ userId: 'outside-user', permission: 'view' })
      expect(await context.sharing.listGrants('owner', context.documentId)).toHaveLength(1)
      await context.sharing.revokeGrant('owner', context.documentId, 'outside-user')
      expect(await context.sharing.listGrants('owner', context.documentId)).toEqual([])
      // Revoking access advances the epoch, so tickets and room keys issued before stop working.
      expect(
        await context.runtime.database
          .selectFrom('document')
          .select('collaborationEpoch')
          .where('id', '=', context.documentId)
          .executeTakeFirstOrThrow()
      ).toEqual({ collaborationEpoch: 1 })
    } finally {
      await context.runtime.close()
    }
  })

  test('accepts an invitation into a direct grant only once', async () => {
    const context = await seedSharing()
    try {
      const created = await context.sharing.createInvitation('owner', context.documentId, {
        email: 'person@example.com',
        permission: 'edit'
      })
      const accepted = await context.sharing.acceptInvitation(
        { userId: 'invited-user', name: 'Invited', email: 'person@example.com' },
        created.invitation.id,
        { token: created.token }
      )
      // The grant names the inviter, so "shared by" shows who shared it.
      expect(accepted).toMatchObject({
        kind: 'document',
        grant: { userId: 'invited-user', permission: 'edit', createdBy: 'owner' }
      })
      await expect(
        context.sharing.acceptInvitation(
          { userId: 'second-user', name: 'Second', email: 'person@example.com' },
          created.invitation.id,
          { token: created.token }
        )
      ).rejects.toBeInstanceOf(DocumentShareInvalidError)
    } finally {
      await context.runtime.close()
    }
  })
})
