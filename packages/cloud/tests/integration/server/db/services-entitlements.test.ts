import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { down, up } from '#cloud/server/db/migrations/029_services_entitlements'
import { down as beforeAccountPlans } from '#cloud/server/db/migrations/030_account_plans'

/** The table 030 replaced with `accountEntitlement`, as 029 found it. */
type LegacyEntitlements = {
  workspaceEntitlement: { workspaceId: string; values: unknown; source: string }
}

describe('migration 029', () => {
  test('moves stored ai entitlements to services and leaves the rest alone', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const [withAI, without] = [crypto.randomUUID(), crypto.randomUUID()]
      await runtime.database
        .insertInto('workspace')
        .values([
          { id: withAI, name: 'Studio', slug: 'studio', createdBy: 'alice', ownerId: 'alice' },
          { id: without, name: 'Lab', slug: 'lab', createdBy: 'alice', ownerId: 'alice' }
        ])
        .execute()
      await beforeAccountPlans(runtime.database)
      const database = runtime.database.withTables<LegacyEntitlements>()
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

      const stored = async () =>
        Object.fromEntries(
          (
            await database
              .selectFrom('workspaceEntitlement')
              .select(['workspaceId', 'values'])
              .execute()
          ).map((row) => [row.workspaceId, row.values])
        )
      const before = await stored()

      await up(database)

      expect(await stored()).toEqual({
        [withAI]: {
          sharing: { links: true },
          services: { enabled: true, monthlyCreditAllowance: 500 }
        },
        [without]: { sharing: { links: false } }
      })
      await down(database)
      expect(await stored()).toEqual(before)
    } finally {
      await runtime.close()
    }
  })
})
