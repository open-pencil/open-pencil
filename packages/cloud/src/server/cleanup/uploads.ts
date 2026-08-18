import type { CloudDatabase } from '#cloud/server/db'
import type { ObjectStore } from '#cloud/server/objects'
import { createStorageQuotaService } from '#cloud/server/quota'
import type { Kysely } from 'kysely'

export type UploadCleanupOptions = {
  batchSize: number
  leaseDurationMs: number
  now?: Date
}

export type UploadCleanupResult = {
  claimed: number
  cleaned: number
  failed: number
}

export type UploadCleanupService = {
  cleanupExpiredUploads(options: UploadCleanupOptions): Promise<UploadCleanupResult>
}

type ClaimedUpload = {
  id: string
  objectKey: string
  multipartUploadId: string | null
}

export function createUploadCleanupService(
  database: Kysely<CloudDatabase>,
  objects: ObjectStore
): UploadCleanupService {
  const quota = createStorageQuotaService(database)
  return {
    async cleanupExpiredUploads(options) {
      const now = options.now ?? new Date()
      const staleBefore = new Date(now.getTime() - options.leaseDurationMs)
      const claimId = crypto.randomUUID()
      const uploads = await database.transaction().execute(async (transaction) => {
        const candidates = await transaction
          .selectFrom('upload')
          .select(['id', 'objectKey', 'multipartUploadId'])
          .where((expression) =>
            expression.or([
              expression.and([
                expression('status', '=', 'pending'),
                expression('expiresAt', '<=', now)
              ]),
              expression.and([
                expression('status', '=', 'cleaning'),
                expression('cleanupClaimedAt', '<=', staleBefore)
              ])
            ])
          )
          .orderBy('expiresAt')
          .limit(options.batchSize)
          .forUpdate()
          .skipLocked()
          .execute()
        if (candidates.length === 0) return []
        const ids = candidates.map((upload) => upload.id)
        await transaction
          .updateTable('upload')
          .set({ status: 'cleaning', cleanupClaimId: claimId, cleanupClaimedAt: now })
          .where('id', 'in', ids)
          .execute()
        return candidates
      })

      let cleaned = 0
      let failed = 0
      for (const upload of uploads) {
        try {
          await removeUploadObject(objects, upload)
          const result = await database
            .updateTable('upload')
            .set({ status: 'abandoned', cleanupClaimId: null, cleanupClaimedAt: null })
            .where('id', '=', upload.id)
            .where('status', '=', 'cleaning')
            .where('cleanupClaimId', '=', claimId)
            .executeTakeFirst()
          if (Number(result.numUpdatedRows) > 0) {
            await quota.release(upload.id)
            cleaned++
          }
        } catch {
          failed++
          await database
            .updateTable('upload')
            .set({ status: 'pending', cleanupClaimId: null, cleanupClaimedAt: null })
            .where('id', '=', upload.id)
            .where('status', '=', 'cleaning')
            .where('cleanupClaimId', '=', claimId)
            .execute()
        }
      }
      return { claimed: uploads.length, cleaned, failed }
    }
  }
}

async function removeUploadObject(objects: ObjectStore, upload: ClaimedUpload): Promise<void> {
  if (upload.multipartUploadId) {
    await objects.abortUpload({ key: upload.objectKey, uploadId: upload.multipartUploadId })
    return
  }
  await objects.delete(upload.objectKey)
}
