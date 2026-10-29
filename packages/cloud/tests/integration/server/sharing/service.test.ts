import { describe, expect, test } from 'bun:test'

import { seedSharing } from '#cloud-tests/helpers/sharing'
import { DocumentForbiddenError } from '#cloud/server'

describe('document sharing facade integration', () => {
  test('prevents viewers from managing sharing', async () => {
    const context = await seedSharing()
    try {
      await expect(
        context.sharing.createShare('viewer', context.documentId, { permission: 'view' })
      ).rejects.toBeInstanceOf(DocumentForbiddenError)
    } finally {
      await context.runtime.close()
    }
  })

  test('shows profiles only of people connected to the document', async () => {
    const context = await seedSharing()
    const outsider = crypto.randomUUID()
    const stranger = crypto.randomUUID()
    try {
      await context.runtime.database
        .insertInto('user')
        .values([
          {
            id: outsider,
            name: 'Outside',
            email: 'outside@example.com',
            emailVerified: true,
            image: null
          },
          {
            id: stranger,
            name: 'Stranger',
            email: 'stranger@example.com',
            emailVerified: true,
            image: null
          }
        ])
        .execute()
      await context.sharing.putGrant('owner', context.documentId, outsider, {
        permission: 'view'
      })
      expect(
        await context.sharing.userProfile('owner', context.documentId, outsider)
      ).toMatchObject({ id: outsider, email: 'outside@example.com' })
      expect(await context.sharing.userProfile('owner', context.documentId, stranger)).toBeNull()
    } finally {
      await context.runtime.close()
    }
  })
})
