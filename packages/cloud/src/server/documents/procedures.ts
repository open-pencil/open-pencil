import { documentsContract, type CloudAPIErrorCode } from '#cloud/contract'
import { documentTokenRoutes } from '#cloud/server/api/tokens'
import {
  DocumentConflictError,
  DocumentForbiddenError,
  DocumentNotFoundError,
  DocumentPurgeFailedError,
  UploadInvalidError
} from '#cloud/server/documents/errors'
import type { DocumentService } from '#cloud/server/documents/service'
import { StorageQuotaExceededError } from '#cloud/server/quota'
import { grantReach, type SignedInProcedureContext } from '#cloud/server/tokens'
import { ORPCError } from '@orpc/client'
import { implement } from '@orpc/server'

/** The code a document domain error answers with, or null for any other error. */
function documentErrorCode(error: unknown): CloudAPIErrorCode | null {
  if (error instanceof DocumentNotFoundError) return 'not_found'
  if (error instanceof DocumentForbiddenError) return 'forbidden'
  if (error instanceof DocumentConflictError) return 'revision_conflict'
  if (error instanceof StorageQuotaExceededError) return 'storage_quota_exceeded'
  // Reported where cleanup failed, so the request handler doesn't report it again.
  if (error instanceof DocumentPurgeFailedError) return 'purge_failed'
  if (error instanceof UploadInvalidError) return 'invalid_upload'
  return null
}

/** Answers a document domain error with its code, and lets every other error through. */
export async function documentErrors<T>(options: { next: () => Promise<T> }): Promise<T> {
  try {
    return await options.next()
  } catch (error) {
    const code = documentErrorCode(error)
    if (code) throw new ORPCError(code, { cause: error })
    throw error
  }
}

/** The documents routes, as the contract describes them, for the signed-in actor. */
export function createDocumentProcedures(service: DocumentService) {
  const documents = implement(documentsContract)
    .$context<SignedInProcedureContext>()
    .use(grantReach(documentTokenRoutes))
    .use(documentErrors)
  return documents.router({
    listShared: documents.listShared.handler(async ({ context }) => ({
      documents: await service.listShared(context.actor.userId)
    })),
    listTrash: documents.listTrash.handler(async ({ context }) => ({
      documents: await service.trash.list(context.actor.userId)
    })),
    restore: documents.restore.handler(async ({ context, input }) => {
      await service.trash.restore(context.actor.userId, input.params.documentId)
    }),
    purge: documents.purge.handler(async ({ context, input }) => {
      await service.trash.purge(context.actor.userId, input.params.documentId)
    }),
    list: documents.list.handler(async ({ context, input, errors }) => {
      const list = await service.list(context.actor.userId, input.params.workspaceId)
      if (!list) throw errors.not_found()
      return { documents: list }
    }),
    usage: documents.usage.handler(async ({ context, input }) => ({
      usage: await service.usage(context.actor.userId, input.params.workspaceId)
    })),
    create: documents.create.handler(async ({ context, input }) => ({
      document: await service.create(context.actor.userId, input.params.workspaceId, input.body)
    })),
    remove: documents.remove.handler(async ({ context, input }) => {
      await service.remove(context.actor.userId, input.params.documentId)
    }),
    access: documents.access.handler(async ({ context, input }) => ({
      access: await service.access(context.actor.userId, input.params.documentId)
    })),
    download: documents.download.handler(async ({ context, input }) => ({
      document: await service.download(context.actor.userId, input.params.documentId)
    })),
    createUpload: documents.createUpload.handler(async ({ context, input }) =>
      service.createUpload(context.actor.userId, input.params.documentId, input.body)
    ),
    commitUpload: documents.commitUpload.handler(async ({ context, input }) => ({
      document: await service.commitUpload(context.actor.userId, input.params.uploadId, input.body)
    })),
    requestImageUploads: documents.requestImageUploads.handler(async ({ context, input }) =>
      service.requestImageUploads(context.actor.userId, input.params.documentId, input.body)
    ),
    commitImageUploads: documents.commitImageUploads.handler(async ({ context, input }) => {
      await service.commitImageUploads(
        context.actor.userId,
        input.params.documentId,
        input.body.uploads
      )
    }),
    imageLinks: documents.imageLinks.handler(async ({ context, input }) =>
      service.imageLinks(context.actor.userId, input.params.documentId, input.body.checksums)
    )
  })
}
