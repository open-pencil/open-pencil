import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'

import { createStorageReconciliationService } from '@open-pencil/cloud/server'

async function seed() {
  const runtime = await createCloudTestDatabase()
  const workspaceId = crypto.randomUUID()
  const documentId = crypto.randomUUID()
  const objectId = crypto.randomUUID()
  await runtime.database
    .insertInto('workspace')
    .values({ id: workspaceId, name: 'W', slug: `w-${workspaceId}`, createdBy: 'u' })
    .execute()
  await runtime.database
    .insertInto('document')
    .values({ id: documentId, workspaceId, name: 'D', createdBy: 'u' })
    .execute()
  await runtime.database
    .insertInto('storageObject')
    .values({
      id: objectId,
      objectKey: 'object',
      checksum: 'sum',
      byteSize: 128,
      contentType: 'application/octet-stream'
    })
    .execute()
  await runtime.database
    .insertInto('documentRevision')
    .values({
      id: crypto.randomUUID(),
      documentId,
      parentRevisionId: null,
      storageObjectId: objectId,
      createdBy: 'u'
    })
    .execute()
  return { runtime, workspaceId }
}

describe('storage reconciliation', () => {
  test('reports and repairs committed-byte drift', async () => {
    const context = await seed()
    try {
      const service = createStorageReconciliationService(context.runtime.database)
      expect(await service.reconcile({ dryRun: true })).toEqual([
        {
          workspaceId: context.workspaceId,
          recordedBytes: 0,
          calculatedBytes: 128,
          corrected: true
        }
      ])
      await service.reconcile({ dryRun: false })
      expect(
        await context.runtime.database
          .selectFrom('workspaceStorageUsage')
          .select('committedBytes')
          .where('workspaceId', '=', context.workspaceId)
          .executeTakeFirst()
      ).toEqual({ committedBytes: 128 })
    } finally {
      await context.runtime.close()
    }
  })
})
