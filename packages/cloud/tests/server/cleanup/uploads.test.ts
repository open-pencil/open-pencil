import { describe, expect, test } from 'bun:test'

import { createUploadCleanupService } from '@open-pencil/cloud/server'

import { createCloudTestDatabase } from '../../helpers/database'
import { createMemoryObjectStore } from '../../helpers/objects'

async function insertExpiredUploads(count: number) {
  const runtime = await createCloudTestDatabase()
  const workspaceId = crypto.randomUUID()
  const documentId = crypto.randomUUID()
  await runtime.database
    .insertInto('workspace')
    .values({
      id: workspaceId,
      name: 'Cleanup',
      slug: `cleanup-${crypto.randomUUID()}`,
      createdBy: 'alice'
    })
    .execute()
  await runtime.database
    .insertInto('document')
    .values({ id: documentId, workspaceId, name: 'Cleanup.fig', createdBy: 'alice' })
    .execute()
  const uploads = Array.from({ length: count }, () => ({
    id: crypto.randomUUID(),
    documentId,
    baseRevisionId: null,
    objectKey: `cleanup/${crypto.randomUUID()}.fig`,
    checksum: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    byteSize: 1,
    contentType: 'application/octet-stream',
    multipartUploadId: null,
    status: 'pending' as const,
    createdBy: 'alice',
    expiresAt: new Date(Date.now() - 60_000)
  }))
  await runtime.database.insertInto('upload').values(uploads).execute()
  return { runtime, uploads }
}

describe('upload cleanup', () => {
  test('limits each cleanup batch', async () => {
    const context = await insertExpiredUploads(3)
    const objects = createMemoryObjectStore()
    try {
      const cleanup = createUploadCleanupService(context.runtime.database, objects.store)
      expect(
        await cleanup.cleanupExpiredUploads({ batchSize: 2, leaseDurationMs: 60_000 })
      ).toEqual({
        claimed: 2,
        cleaned: 2,
        failed: 0
      })
      expect(objects.deletedKeys).toHaveLength(2)
      expect(
        await context.runtime.database
          .selectFrom('upload')
          .select(({ fn }) => fn.countAll<number>().as('count'))
          .where('status', '=', 'pending')
          .executeTakeFirstOrThrow()
      ).toEqual({ count: 1 })
    } finally {
      await context.runtime.close()
    }
  })

  test('reclaims stale cleanup leases', async () => {
    const context = await insertExpiredUploads(1)
    const objects = createMemoryObjectStore()
    try {
      await context.runtime.database
        .updateTable('upload')
        .set({
          status: 'cleaning',
          cleanupClaimId: crypto.randomUUID(),
          cleanupClaimedAt: new Date(Date.now() - 120_000)
        })
        .execute()
      const cleanup = createUploadCleanupService(context.runtime.database, objects.store)
      expect(
        await cleanup.cleanupExpiredUploads({ batchSize: 1, leaseDurationMs: 60_000 })
      ).toEqual({
        claimed: 1,
        cleaned: 1,
        failed: 0
      })
    } finally {
      await context.runtime.close()
    }
  })
})
