import {
  createDocumentCleanupService,
  createUploadCleanupService
} from '@open-pencil/cloud/server'
import { createNodeCloudApplication } from '@open-pencil/cloud/runtime/node'

export const config = { maxDuration: 60 }

export async function GET(request: Request): Promise<Response> {
  const authorization = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: { code: 'unauthorized' } }, { status: 401 })
  }
  const runtime = await createNodeCloudApplication()
  try {
    const uploads = await createUploadCleanupService(
      runtime.database,
      runtime.objects
    ).cleanupExpiredUploads({
      batchSize: runtime.config.cleanupBatchSize,
      leaseDurationMs: runtime.config.cleanupLeaseDurationMs
    })
    const documents = await createDocumentCleanupService(
      runtime.database,
      runtime.objects
    ).cleanupDeletedDocuments({
      batchSize: runtime.config.cleanupBatchSize,
      leaseDurationMs: runtime.config.cleanupLeaseDurationMs,
      retentionMs: runtime.config.documentRetentionMs
    })
    return Response.json({ uploads, documents })
  } finally {
    await runtime.database.destroy()
  }
}
