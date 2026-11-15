import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import {
  createAccountEntitlementRepository,
  DatabaseEntitlementSource,
  staticEntitlementValues
} from '#cloud/server'

async function seed() {
  const runtime = await createCloudTestDatabase()
  const workspaceId = crypto.randomUUID()
  await runtime.database
    .insertInto('workspace')
    .values({ id: workspaceId, name: 'W', slug: `w-${workspaceId}`, createdBy: 'u', ownerId: 'u' })
    .execute()
  return { runtime, workspaceId, ownerId: 'u' }
}

describe('database entitlement source', () => {
  test('stores structured values with revisions and resolves canonical keys', async () => {
    const context = await seed()
    try {
      const repository = createAccountEntitlementRepository(context.runtime.database)
      await repository.set(
        context.ownerId,
        {
          documents: { maximumFileBytes: 100 },
          sharing: { guestEdit: false },
          storage: {},
          collaboration: {}
        },
        'test'
      )
      await repository.set(
        context.ownerId,
        {
          documents: { maximumFileBytes: 200 },
          sharing: { guestEdit: true },
          storage: {},
          collaboration: {}
        },
        'test'
      )
      expect(await repository.get(context.ownerId)).toMatchObject({
        revision: 2,
        source: 'test'
      })
      const source = new DatabaseEntitlementSource(context.runtime.database)
      const subject = { type: 'user' as const, id: context.ownerId }
      expect(await source.number(subject, 'cloud.documents.maximum-file-bytes')).toBe(200)
      expect(await source.boolean(subject, 'cloud.sharing.guest-edit')).toBe(true)
      expect(await source.boolean(subject, 'unknown')).toBeNull()
    } finally {
      await context.runtime.close()
    }
  })

  test('gives an account without stored entitlements the defaults, and a stored plan over them', async () => {
    const context = await seed()
    try {
      const free = staticEntitlementValues({
        storage: { maximumBytes: 300 },
        services: { enabled: false }
      })
      const source = new DatabaseEntitlementSource(context.runtime.database, free)
      const subject = { type: 'user' as const, id: context.ownerId }
      expect(await source.number(subject, 'cloud.storage.maximum-bytes')).toBe(300)
      expect(await source.boolean(subject, 'cloud.services.enabled')).toBe(false)

      await createAccountEntitlementRepository(context.runtime.database).set(
        context.ownerId,
        { storage: { maximumBytes: 10_000 } },
        'billing'
      )
      expect(await source.number(subject, 'cloud.storage.maximum-bytes')).toBe(10_000)
      // A value the stored plan leaves out is still the default's.
      expect(await source.boolean(subject, 'cloud.services.enabled')).toBe(false)
    } finally {
      await context.runtime.close()
    }
  })
})
