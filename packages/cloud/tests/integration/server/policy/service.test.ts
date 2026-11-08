import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import {
  CLOUD_FEATURE_KEYS,
  createAccountEntitlementRepository,
  createDefaultCloudPolicy,
  DatabaseEntitlementSource,
  createEntitlementService,
  EntitlementOpenFeatureProvider,
  StaticEntitlementSource
} from '#cloud/server'

async function workspaceLimits(participants: number, technicalMaximumParticipants: number) {
  const runtime = await createCloudTestDatabase()
  try {
    const workspaceId = crypto.randomUUID()
    await runtime.database
      .insertInto('workspace')
      .values({
        id: workspaceId,
        name: 'W',
        slug: `w-${workspaceId}`,
        createdBy: 'owner',
        ownerId: 'owner'
      })
      .execute()
    await runtime.database
      .insertInto('workspaceMember')
      .values({ workspaceId, userId: 'owner', role: 'admin' })
      .execute()
    const policy = createDefaultCloudPolicy(
      new EntitlementOpenFeatureProvider(
        new StaticEntitlementSource({ [CLOUD_FEATURE_KEYS.maximumParticipants]: participants })
      )
    )
    const service = createEntitlementService(
      runtime.database,
      policy,
      1_000_000,
      technicalMaximumParticipants
    )
    return (await service.workspace('owner', workspaceId)).limits
  } finally {
    await runtime.close()
  }
}

describe('workspace entitlements', () => {
  test('never report more participants than a room accepts', async () => {
    expect((await workspaceLimits(5000, 1000)).maximumParticipants).toBe(1000)
    expect((await workspaceLimits(10, 1000)).maximumParticipants).toBe(10)
  })

  test('give every workspace its owner’s plan and storage, whoever asks', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const [first, second] = [crypto.randomUUID(), crypto.randomUUID()]
      await runtime.database
        .insertInto('workspace')
        .values(
          [first, second].map((id) => ({
            id,
            name: 'W',
            slug: `w-${id}`,
            createdBy: 'owner',
            ownerId: 'owner'
          }))
        )
        .execute()
      await runtime.database
        .insertInto('workspaceMember')
        .values([
          { workspaceId: first, userId: 'owner', role: 'admin' },
          { workspaceId: second, userId: 'owner', role: 'admin' },
          { workspaceId: second, userId: 'member', role: 'editor' }
        ])
        .execute()
      await runtime.database
        .insertInto('workspaceStorageUsage')
        .values({ workspaceId: first, committedBytes: 40 })
        .execute()
      await createAccountEntitlementRepository(runtime.database).set(
        'owner',
        { storage: { maximumBytes: 100 } },
        'billing'
      )
      const service = createEntitlementService(
        runtime.database,
        createDefaultCloudPolicy(
          new EntitlementOpenFeatureProvider(new DatabaseEntitlementSource(runtime.database))
        ),
        1_000_000
      )
      const entitlements = await service.workspace('member', second)
      expect(entitlements.limits.maximumStorageBytes).toBe(100)
      expect(entitlements.usage).toEqual({ committedStorageBytes: 40, reservedStorageBytes: 0 })
    } finally {
      await runtime.close()
    }
  })
})
