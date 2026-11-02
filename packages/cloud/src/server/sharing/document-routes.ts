import { parseRequestSharedImageLinks, parseResolveDocumentShare } from '#cloud/contract'
import type { CloudSessionResolver } from '#cloud/server/auth'
import type { DocumentService } from '#cloud/server/documents'
import type { DocumentSharingService } from '#cloud/server/sharing'
import { sharingRoute } from '#cloud/server/sharing/http'
import { validatedJSON } from '#cloud/server/validation'
import { Hono } from 'hono'

import { shareActor } from './actor'

export function createPublicDocumentRoutes(
  sharing: DocumentSharingService,
  documents: DocumentService,
  resolveSession?: CloudSessionResolver
) {
  return new Hono()
    .post('/shares/:shareId/document', validatedJSON(parseResolveDocumentShare), (context) =>
      sharingRoute(context, async () => {
        const resolution = await sharing.resolveShare(
          context.req.param('shareId'),
          context.req.valid('json'),
          await shareActor(context.req.raw, resolveSession)
        )
        return context.json({
          resolution,
          document: await documents.downloadShared(resolution.documentId)
        })
      })
    )
    .post('/shares/:shareId/images', validatedJSON(parseRequestSharedImageLinks), (context) =>
      sharingRoute(context, async () => {
        const { checksums, ...share } = context.req.valid('json')
        const resolution = await sharing.resolveShare(
          context.req.param('shareId'),
          share,
          await shareActor(context.req.raw, resolveSession)
        )
        return context.json(await documents.imageLinksShared(resolution.documentId, checksums))
      })
    )
}
