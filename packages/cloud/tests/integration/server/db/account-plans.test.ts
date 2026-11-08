import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { down, up } from '#cloud/server/db/migrations/030_account_plans'

type LegacyEntitlements = {
  workspaceEntitlement: {
    workspaceId: string
    values: unknown
    source: string
    revision?: number
    externalVersion?: number | null
    updatedAt: Date
  }
}

describe('migration 030', () => {
  test('gives each workspace an owner and moves its entitlements to the owner', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const [kept, orphaned, older] = [
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID()
      ]
      await runtime.database
        .insertInto('workspace')
        .values([
          { id: kept, name: 'Kept', slug: 'kept', createdBy: 'alice', ownerId: 'alice' },
          // Its creator left; Carol has been an admin longer than Dave.
          { id: orphaned, name: 'Orphaned', slug: 'orphaned', createdBy: 'bob', ownerId: 'bob' },
          { id: older, name: 'Older', slug: 'older', createdBy: 'alice', ownerId: 'alice' }
        ])
        .execute()
      await runtime.database
        .insertInto('workspaceMember')
        .values([
          { workspaceId: kept, userId: 'alice', role: 'editor' },
          {
            workspaceId: orphaned,
            userId: 'dave',
            role: 'admin',
            createdAt: new Date('2026-02-01T00:00:00Z')
          },
          {
            workspaceId: orphaned,
            userId: 'carol',
            role: 'admin',
            createdAt: new Date('2026-01-01T00:00:00Z')
          },
          { workspaceId: older, userId: 'alice', role: 'admin' }
        ])
        .execute()
      await down(runtime.database)
      const database = runtime.database.withTables<LegacyEntitlements>()
      await database
        .insertInto('workspaceEntitlement')
        .values([
          {
            workspaceId: kept,
            values: { storage: { maximumBytes: 2 } },
            source: 'billing',
            revision: 7,
            externalVersion: 42,
            updatedAt: new Date('2026-03-02T00:00:00Z')
          },
          {
            workspaceId: older,
            values: { storage: { maximumBytes: 1 } },
            source: 'billing',
            updatedAt: new Date('2026-03-01T00:00:00Z')
          },
          {
            workspaceId: orphaned,
            values: { storage: { maximumBytes: 3 } },
            source: 'operator',
            updatedAt: new Date('2026-03-01T00:00:00Z')
          }
        ])
        .execute()

      await up(runtime.database)

      const owners = await runtime.database
        .selectFrom('workspace')
        .select(['id', 'ownerId'])
        .execute()
      expect(Object.fromEntries(owners.map((row) => [row.id, row.ownerId]))).toEqual({
        [kept]: 'alice',
        [orphaned]: 'carol',
        [older]: 'alice'
      })
      const entitlements = await runtime.database
        .selectFrom('accountEntitlement')
        .select(['userId', 'values', 'source', 'revision', 'externalVersion', 'updatedAt'])
        .orderBy('userId')
        .execute()
      // The billing version moves with the plan, so an older billing event cannot replace it.
      expect(
        entitlements.map((row) => ({
          ...row,
          externalVersion: row.externalVersion === null ? null : Number(row.externalVersion),
          updatedAt: new Date(row.updatedAt).toISOString()
        }))
      ).toEqual([
        {
          userId: 'alice',
          values: { storage: { maximumBytes: 2 } },
          source: 'billing',
          revision: 7,
          externalVersion: 42,
          updatedAt: '2026-03-02T00:00:00.000Z'
        },
        {
          userId: 'carol',
          values: { storage: { maximumBytes: 3 } },
          source: 'operator',
          revision: 1,
          externalVersion: null,
          updatedAt: '2026-03-01T00:00:00.000Z'
        }
      ])
    } finally {
      await runtime.close()
    }
  })
})
