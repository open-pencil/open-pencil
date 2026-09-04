import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'
import { createMemoryObjectStore } from '#cloud-test/helpers/objects'

import { createDocumentCleanupService } from '@open-pencil/cloud/server'

async function deletedDocument() {
  const runtime = await createCloudTestDatabase()
  const workspaceId = crypto.randomUUID()
  const documentId = crypto.randomUUID()
  const storageObjectId = crypto.randomUUID()
  const revisionId = crypto.randomUUID()
  const objectKey = `documents/${workspaceId}/${documentId}/revision.fig`
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
    .values({ id: documentId, workspaceId, name: 'Deleted.fig', createdBy: 'alice' })
    .execute()
  await runtime.database
    .insertInto('storageObject')
    .values({
      id: storageObjectId,
      objectKey,
      checksum: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      byteSize: 128,
      contentType: 'application/octet-stream'
    })
    .execute()
  await runtime.database
    .insertInto('documentRevision')
    .values({
      id: revisionId,
      documentId,
      parentRevisionId: null,
      storageObjectId,
      createdBy: 'alice'
    })
    .execute()
  await runtime.database
    .updateTable('document')
    .set({ currentRevisionId: revisionId, deletedAt: new Date(Date.now() - 60_000) })
    .where('id', '=', documentId)
    .execute()
  return { runtime, documentId, objectKey }
}

describe('document cleanup', () => {
  test('retains recently deleted documents', async () => {
    const context = await deletedDocument()
    try {
      const cleanup = createDocumentCleanupService(
        context.runtime.database,
        createMemoryObjectStore().store
      )
      expect(
        await cleanup.cleanupDeletedDocuments({
          batchSize: 10,
          leaseDurationMs: 60_000,
          retentionMs: 120_000
        })
      ).toEqual({ claimed: 0, cleaned: 0, failed: 0, objectsDeleted: 0, bytesReclaimed: 0 })
    } finally {
      await context.runtime.close()
    }
  })

  test('removes retained revision objects and hard-deletes the document', async () => {
    const context = await deletedDocument()
    const objects = createMemoryObjectStore()
    try {
      const cleanup = createDocumentCleanupService(context.runtime.database, objects.store)
      expect(
        await cleanup.cleanupDeletedDocuments({
          batchSize: 10,
          leaseDurationMs: 60_000,
          retentionMs: 0
        })
      ).toEqual({ claimed: 1, cleaned: 1, failed: 0, objectsDeleted: 1, bytesReclaimed: 128 })
      expect(objects.deletedKeys).toEqual([context.objectKey])
      expect(
        await context.runtime.database
          .selectFrom('document')
          .select('id')
          .where('id', '=', context.documentId)
          .executeTakeFirst()
      ).toBeUndefined()
    } finally {
      await context.runtime.close()
    }
  })
})
