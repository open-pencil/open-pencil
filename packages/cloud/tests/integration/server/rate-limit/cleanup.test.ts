import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'

import { createRateLimitCleanupService } from '@open-pencil/cloud/server'

describe('Cloud rate-limit cleanup', () => {
  test('removes expired counters and keeps active windows', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      await runtime.database
        .insertInto('cloudRateLimit')
        .values([
          { keyHash: 'old', windowStartedAt: new Date('2025-01-01'), requestCount: 1 },
          { keyHash: 'active', windowStartedAt: new Date('2026-01-02'), requestCount: 1 }
        ])
        .execute()
      expect(
        await createRateLimitCleanupService(runtime.database).cleanupExpired(new Date('2026-01-01'))
      ).toBe(1)
      expect(
        await runtime.database.selectFrom('cloudRateLimit').select('keyHash').execute()
      ).toEqual([{ keyHash: 'active' }])
    } finally {
      await runtime.close()
    }
  })
})
