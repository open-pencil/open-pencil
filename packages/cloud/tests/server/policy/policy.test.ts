import { describe, expect, test } from 'bun:test'

import { CLOUD_FEATURE_KEYS, createDefaultCloudPolicy } from '@open-pencil/cloud/server'

const context = {
  targetingKey: 'workspace-1',
  workspaceId: 'workspace-1',
  deploymentMode: 'self-hosted' as const
}

describe('Cloud OpenFeature policy', () => {
  test('evaluates typed safe defaults through OpenFeature', async () => {
    const policy = await createDefaultCloudPolicy()
    expect(await policy.boolean(CLOUD_FEATURE_KEYS.capabilityLinks, false, context)).toBe(true)
    expect(await policy.boolean(CLOUD_FEATURE_KEYS.serverEnforcedWrites, true, context)).toBe(false)
    expect(await policy.number(CLOUD_FEATURE_KEYS.maximumFileBytes, 1, context)).toBe(
      1024 * 1024 * 1024
    )
  })
})
