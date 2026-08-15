import { parseResolveDocumentShare } from '#cloud/contract'
import type { DocumentService } from '#cloud/server/documents'
import type { DocumentSharingService } from '#cloud/server/sharing'
import { sharingRoute } from '#cloud/server/sharing/http'
import { validatedJSON } from '#cloud/server/validation'
import { Hono } from 'hono'

export function createPublicDocumentRoutes(
  sharing: DocumentSharingService,
  documents: DocumentService
) {
  return new Hono().post(
    '/shares/:shareId/document',
    validatedJSON(parseResolveDocumentShare),
    (context) =>
      sharingRoute(context, async () => {
        const resolution = await sharing.resolveShare(
          context.req.param('shareId'),
          context.req.valid('json')
        )
        return context.json({
          resolution,
          document: await documents.downloadShared(resolution.documentId)
        })
      })
  )
}
