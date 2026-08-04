import { expect, test } from 'bun:test'

import { runWithWebLock } from '@/app/storage/sync/runtime'
import { syncCrossTabLockUnavailable } from '@/app/storage/sync/status'

const locksAvailable = typeof navigator !== 'undefined' && Boolean(navigator.locks)

/**
 * Without `navigator.locks` the cross-tab drain race is re-exposed. That
 * environment cannot be fixed from here, so the contract is observability: the
 * drain still runs, the status state records the degraded guarantee, and the
 * warning fires once rather than on every drain.
 */
test.skipIf(locksAvailable)(
  'an environment without Web Locks drains unlocked, warns once, and marks the status',
  async () => {
    const warnings: string[] = []
    const realWarn = console.warn
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '))
    }
    try {
      let ran = 0
      await runWithWebLock('openpencil-test-lock', async () => {
        ran++
      })
      await runWithWebLock('openpencil-test-lock', async () => {
        ran++
      })

      expect(ran).toBe(2)
      expect(syncCrossTabLockUnavailable.value).toBe(true)
      expect(warnings.filter((text) => text.includes('navigator.locks'))).toHaveLength(1)
    } finally {
      console.warn = realWarn
    }
  }
)
