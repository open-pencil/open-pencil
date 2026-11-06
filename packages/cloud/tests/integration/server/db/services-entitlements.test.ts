import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { moveEntitlements } from '#cloud/server/db/migrations/029_services_entitlements'

describe('migration 029', () => {
  test('moves stored ai entitlements to services and leaves the rest alone', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const { database } = runtime
      const [withAI, without] = [crypto.randomUUID(), crypto.randomUUID()]
      await database
        .insertInto('workspace')
        .values([
          { id: withAI, name: 'Studio', slug: 'studio', createdBy: 'alice' },
          { id: without, name: 'Lab', slug: 'lab', createdBy: 'alice' }
        ])
        .execute()
      await database
        .insertInto('workspaceEntitlement')
        .values([
          {
            workspaceId: withAI,
            values: {
              sharing: { links: true },
              ai: { enabled: true, monthlyCreditAllowance: 500 }
            },
            source: 'billing'
          },
          { workspaceId: without, values: { sharing: { links: false } }, source: 'billing' }
        ])
        .execute()

      await moveEntitlements(database, 'ai', 'services')

      const rows = await database
        .selectFrom('workspaceEntitlement')
        .select(['workspaceId', 'values'])
        .execute()
      expect(Object.fromEntries(rows.map((row) => [row.workspaceId, row.values]))).toEqual({
        [withAI]: {
          sharing: { links: true },
          services: { enabled: true, monthlyCreditAllowance: 500 }
        },
        [without]: { sharing: { links: false } }
      })
    } finally {
      await runtime.close()
    }
  })
})
