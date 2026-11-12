import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import {
  createDefaultCloudPolicy,
  createStorageLimitNoticeService,
  createTransactionalEmailService,
  EntitlementOpenFeatureProvider,
  StaticEntitlementSource,
  staticEntitlementValues
} from '#cloud/server'

const MAXIMUM_BYTES = 1000
const OWNER_ID = crypto.randomUUID()

/** An owner on a plan of `MAXIMUM_BYTES` with one workspace, and the notices for their storage. */
async function seed(options: { upgradable: boolean } = { upgradable: true }) {
  const runtime = await createCloudTestDatabase()
  const { database } = runtime
  const workspaceId = crypto.randomUUID()
  await database
    .insertInto('user')
    .values({
      id: OWNER_ID,
      name: 'Ada',
      email: 'ada@example.com',
      emailVerified: true,
      image: null,
      role: 'user',
      banned: false
    })
    .execute()
  await database
    .insertInto('workspace')
    .values({
      id: workspaceId,
      name: 'Design',
      slug: `design-${workspaceId}`,
      createdBy: OWNER_ID,
      ownerId: OWNER_ID
    })
    .execute()
  await database
    .insertInto('workspaceStorageUsage')
    .values({ workspaceId, committedBytes: 0 })
    .execute()
  const notices = createStorageLimitNoticeService(database, {
    policy: createDefaultCloudPolicy(
      new EntitlementOpenFeatureProvider(
        new StaticEntitlementSource(
          staticEntitlementValues({ storage: { maximumBytes: MAXIMUM_BYTES } })
        )
      )
    ),
    email: createTransactionalEmailService(database, {
      encryptionSecret: 'storage-notice-test-secret-at-least-32-characters',
      from: 'cloud@example.com'
    }),
    publicURL: 'https://cloud.example.com',
    upgradable: options.upgradable,
    deploymentMode: 'official'
  })
  return {
    runtime,
    notices,
    async hold(bytes: number) {
      await database
        .updateTable('workspaceStorageUsage')
        .set({ committedBytes: bytes })
        .where('workspaceId', '=', workspaceId)
        .execute()
    },
    async sent() {
      const rows = await database
        .selectFrom('transactionalEmail')
        .select(['kind', 'recipientEmailNormalized'])
        .execute()
      return rows.map((row) => `${row.kind} ${row.recipientEmailNormalized}`)
    }
  }
}

describe('storage limit notices', () => {
  test('tell an owner once when they hold their whole allowance, and not before', async () => {
    const { runtime, notices, hold, sent } = await seed()
    try {
      await hold(MAXIMUM_BYTES - 1)
      expect(await notices.notifyStorageLimits()).toEqual({ notified: 0, cleared: 0 })
      await hold(MAXIMUM_BYTES)
      expect(await notices.notifyStorageLimits()).toEqual({ notified: 1, cleared: 0 })
      expect(await notices.notifyStorageLimits()).toEqual({ notified: 0, cleared: 0 })
      expect(await sent()).toEqual(['storage-limit-reached ada@example.com'])
    } finally {
      await runtime.close()
    }
  })

  test('tell an owner again after they freed space and filled it again', async () => {
    const { runtime, notices, hold, sent } = await seed()
    try {
      await hold(MAXIMUM_BYTES)
      await notices.notifyStorageLimits()
      await hold(MAXIMUM_BYTES / 2)
      expect(await notices.notifyStorageLimits()).toEqual({ notified: 0, cleared: 1 })
      await hold(MAXIMUM_BYTES + 1)
      expect(await notices.notifyStorageLimits()).toEqual({ notified: 1, cleared: 0 })
      expect(await sent()).toHaveLength(2)
    } finally {
      await runtime.close()
    }
  })
})
