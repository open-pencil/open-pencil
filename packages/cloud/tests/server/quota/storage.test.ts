import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'

import { createStorageQuotaService, StorageQuotaExceededError } from '@open-pencil/cloud/server'

async function seed() {
  const runtime = await createCloudTestDatabase()
  const workspaceId = crypto.randomUUID()
  const documentId = crypto.randomUUID()
  await runtime.database
    .insertInto('workspace')
    .values({
      id: workspaceId,
      name: 'Workspace',
      slug: `workspace-${workspaceId}`,
      createdBy: 'u'
    })
    .execute()
  await runtime.database
    .insertInto('document')
    .values({ id: documentId, workspaceId, name: 'Document', createdBy: 'u' })
    .execute()
  async function upload(uploadId: string) {
    await runtime.database
      .insertInto('upload')
      .values({
        id: uploadId,
        documentId,
        baseRevisionId: null,
        objectKey: `uploads/${uploadId}`,
        checksum: 'checksum',
        byteSize: 60,
        contentType: 'application/octet-stream',
        multipartUploadId: null,
        status: 'pending',
        createdBy: 'u',
        expiresAt: new Date(Date.now() + 60_000)
      })
      .execute()
  }
  return { runtime, workspaceId, upload }
}

describe('storage quota reservations', () => {
  test('atomically accounts for reserved and committed storage', async () => {
    const context = await seed()
    try {
      const quota = createStorageQuotaService(context.runtime.database)
      const first = crypto.randomUUID()
      const second = crypto.randomUUID()
      await context.upload(first)
      await context.upload(second)
      await quota.reserve({
        workspaceId: context.workspaceId,
        uploadId: first,
        bytes: 60,
        expiresAt: new Date(Date.now() + 60_000),
        maximumBytes: 100
      })
      await expect(
        quota.reserve({
          workspaceId: context.workspaceId,
          uploadId: second,
          bytes: 60,
          expiresAt: new Date(Date.now() + 60_000),
          maximumBytes: 100
        })
      ).rejects.toBeInstanceOf(StorageQuotaExceededError)
      await quota.commit(first)
      expect(await quota.snapshot(context.workspaceId)).toEqual({
        committedBytes: 60,
        reservedBytes: 0
      })
    } finally {
      await context.runtime.close()
    }
  })
})
