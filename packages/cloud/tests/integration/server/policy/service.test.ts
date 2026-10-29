import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import {
  CLOUD_FEATURE_KEYS,
  createDefaultCloudPolicy,
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
      .values({ id: workspaceId, name: 'W', slug: `w-${workspaceId}`, createdBy: 'owner' })
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
})
