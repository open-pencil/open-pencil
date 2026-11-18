import { describe, expect, test } from 'bun:test'

import {
  CLOUD_FEATURE_KEYS,
  createDefaultCloudPolicy,
  EntitlementOpenFeatureProvider,
  type EntitlementSource
} from '#cloud/server'

const context = {
  targetingKey: 'owner-1',
  subjectType: 'user' as const,
  workspaceId: 'workspace-1',
  deploymentMode: 'self-hosted' as const
}

describe('Cloud OpenFeature policy', () => {
  test('evaluates typed safe defaults through OpenFeature', async () => {
    const policy = await createDefaultCloudPolicy()
    expect(await policy.boolean(CLOUD_FEATURE_KEYS.links, false, context)).toBe(true)
    expect(await policy.boolean(CLOUD_FEATURE_KEYS.serverEnforcedWrites, true, context)).toBe(false)
    expect(await policy.number(CLOUD_FEATURE_KEYS.maximumFileBytes, 1, context)).toBe(
      1024 * 1024 * 1024
    )
  })

  test('tells a provider that failed from a flag it doesn’t know', async () => {
    const policy = createDefaultCloudPolicy()
    expect(
      await policy.numberResolution(CLOUD_FEATURE_KEYS.maximumStorageBytes, 7, context)
    ).toEqual({ value: 7, failed: false })
    const failing: EntitlementSource = {
      boolean: () => Promise.reject(new Error('down')),
      number: () => Promise.reject(new Error('down')),
      string: () => Promise.reject(new Error('down'))
    }
    const unreachable = createDefaultCloudPolicy(new EntitlementOpenFeatureProvider(failing))
    expect(
      await unreachable.numberResolution(CLOUD_FEATURE_KEYS.maximumStorageBytes, 7, context)
    ).toEqual({ value: 7, failed: true })
    expect(await unreachable.number(CLOUD_FEATURE_KEYS.maximumStorageBytes, 7, context)).toBe(7)
  })
})
