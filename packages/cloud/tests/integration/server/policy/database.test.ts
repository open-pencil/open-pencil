import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'

import {
  createWorkspaceEntitlementRepository,
  DatabaseEntitlementSource
} from '@open-pencil/cloud/server'

async function seed() {
  const runtime = await createCloudTestDatabase()
  const workspaceId = crypto.randomUUID()
  await runtime.database
    .insertInto('workspace')
    .values({ id: workspaceId, name: 'W', slug: `w-${workspaceId}`, createdBy: 'u' })
    .execute()
  return { runtime, workspaceId }
}

describe('database entitlement source', () => {
  test('stores structured values with revisions and resolves canonical keys', async () => {
    const context = await seed()
    try {
      const repository = createWorkspaceEntitlementRepository(context.runtime.database)
      await repository.set(
        context.workspaceId,
        {
          documents: { maximumFileBytes: 100 },
          sharing: { anonymousEdit: false },
          storage: {},
          collaboration: {}
        },
        'test'
      )
      await repository.set(
        context.workspaceId,
        {
          documents: { maximumFileBytes: 200 },
          sharing: { anonymousEdit: true },
          storage: {},
          collaboration: {}
        },
        'test'
      )
      expect(await repository.get(context.workspaceId)).toMatchObject({
        revision: 2,
        source: 'test'
      })
      const source = new DatabaseEntitlementSource(context.runtime.database)
      const subject = { type: 'workspace' as const, id: context.workspaceId }
      expect(await source.number(subject, 'cloud.documents.maximum-file-bytes')).toBe(200)
      expect(await source.boolean(subject, 'cloud.sharing.anonymous-edit')).toBe(true)
      expect(await source.boolean(subject, 'unknown')).toBeNull()
    } finally {
      await context.runtime.close()
    }
  })
})
