import { describe, expect, test } from 'bun:test'

import { StaticEntitlementSource } from '@open-pencil/cloud/server'

const workspace = { type: 'workspace' as const, id: 'workspace-1' }

describe('entitlement source', () => {
  test('returns typed values and null for unavailable entitlements', async () => {
    const source = new StaticEntitlementSource({
      anonymous: true,
      maximumFileBytes: 1024,
      tier: 'self-hosted'
    })
    expect(await source.boolean(workspace, 'anonymous')).toBe(true)
    expect(await source.number(workspace, 'maximumFileBytes')).toBe(1024)
    expect(await source.string(workspace, 'tier')).toBe('self-hosted')
    expect(await source.number(workspace, 'unknown')).toBeNull()
  })
})
