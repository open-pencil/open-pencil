import { describe, expect, test } from 'bun:test'

import { seedSharing } from '#cloud-test/helpers/sharing'

import { DocumentShareInvalidError } from '@open-pencil/cloud/server'

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
      expect(accepted).toMatchObject({ userId: 'invited-user', permission: 'edit' })
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
