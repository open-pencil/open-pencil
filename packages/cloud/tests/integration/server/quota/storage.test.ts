import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createStorageQuotaService, StorageQuotaExceededError } from '#cloud/server'

async function seed() {
  const runtime = await createCloudTestDatabase()
  /** A workspace `ownerId` owns, with one document; its ID and the document's. */
  async function workspace(ownerId: string) {
    const workspaceId = crypto.randomUUID()
    const documentId = crypto.randomUUID()
    await runtime.database
      .insertInto('workspace')
      .values({
        id: workspaceId,
        name: 'Workspace',
        slug: `workspace-${workspaceId}`,
        createdBy: ownerId,
        ownerId
      })
      .execute()
    await runtime.database
      .insertInto('document')
      .values({ id: documentId, workspaceId, name: 'Document', createdBy: ownerId })
      .execute()
    return { workspaceId, documentId }
  }
  const { workspaceId, documentId: firstDocument } = await workspace('u')
  async function upload(uploadId: string, documentId = firstDocument) {
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
        finalizationStartedAt: null,
        createdBy: 'u',
        expiresAt: new Date(Date.now() + 60_000)
      })
      .execute()
  }
  return { runtime, workspaceId, upload, workspace }
}

describe('storage quota reservations', () => {
  test('rolls back an owning upload insert when reservation fails', async () => {
    const context = await seed()
    try {
      const quota = createStorageQuotaService(context.runtime.database)
      const uploadId = crypto.randomUUID()
      await expect(
        context.runtime.database.transaction().execute(async (transaction) => {
          await transaction
            .insertInto('upload')
            .values({
              id: uploadId,
              documentId: await transaction
                .selectFrom('document')
                .select('id')
                .executeTakeFirstOrThrow()
                .then((document) => document.id),
              baseRevisionId: null,
              objectKey: `uploads/${uploadId}`,
              checksum: 'checksum',
              byteSize: 60,
              contentType: 'application/octet-stream',
              multipartUploadId: null,
              status: 'pending',
              finalizationStartedAt: null,
              createdBy: 'u',
              expiresAt: new Date(Date.now() + 60_000)
            })
            .execute()
          await quota.reserveInTransaction(transaction, {
            workspaceId: context.workspaceId,
            uploadId,
            bytes: 60,
            expiresAt: new Date(Date.now() + 60_000),
            maximumBytes: 0
          })
        })
      ).rejects.toBeInstanceOf(StorageQuotaExceededError)
      expect(
        await context.runtime.database
          .selectFrom('upload')
          .select('id')
          .where('id', '=', uploadId)
          .executeTakeFirst()
      ).toBeUndefined()
    } finally {
      await context.runtime.close()
    }
  })

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

  test('draws every workspace an account owns from its one allowance', async () => {
    const context = await seed()
    try {
      const quota = createStorageQuotaService(context.runtime.database)
      const sibling = await context.workspace('u')
      const stranger = await context.workspace('someone-else')
      const reserve = async (workspaceId: string, documentId: string) => {
        const uploadId = crypto.randomUUID()
        await context.upload(uploadId, documentId)
        await quota.reserve({
          workspaceId,
          uploadId,
          bytes: 60,
          expiresAt: new Date(Date.now() + 60_000),
          maximumBytes: 100
        })
        return uploadId
      }
      const kept = await reserve(
        context.workspaceId,
        (
          await context.runtime.database
            .selectFrom('document')
            .select('id')
            .where('workspaceId', '=', context.workspaceId)
            .executeTakeFirstOrThrow()
        ).id
      )
      await quota.commit(kept)

      await expect(reserve(sibling.workspaceId, sibling.documentId)).rejects.toBeInstanceOf(
        StorageQuotaExceededError
      )
      expect(await quota.snapshot(sibling.workspaceId)).toEqual({
        committedBytes: 60,
        reservedBytes: 0
      })
      // Someone else's workspace has an allowance of its own.
      await reserve(stranger.workspaceId, stranger.documentId)
    } finally {
      await context.runtime.close()
    }
  })
})
