import { COMMUNITY_THUMBNAIL_PATH, communityObjectQuerySchema } from '#cloud/contract'
import { documentDomainError } from '#cloud/server/documents'
import { documentRevisionParams, documentParams, validatedQuery } from '#cloud/server/validation'
import { Hono, type Context } from 'hono'

import type { CommunityService } from './service'

const notFound = (context: Context) => context.json({ error: { code: 'not_found' as const } }, 404)

/** Answers a missing or hidden gallery document as not found, like any document outside it. */
async function communityRoute(context: Context, action: () => Promise<Response>) {
  try {
    return await action()
  } catch (error) {
    const response = documentDomainError(context, error)
    if (response) return response
    throw error
  }
}

/**
 * A gallery document's stored parts, its file or one of its images, for anyone, through the
 * server rather than a storage link, which answers only the deployment's own pages: anyone may
 * open a gallery document, from any page, such as the docs landing in development or a preview.
 * Cached only as long as the listing is, so a takedown reaches every copy within minutes. The
 * gallery's JSON routes are the contract's (`communityContract`).
 */
export function createCommunityObjectRoutes(community: CommunityService) {
  return new Hono().get(
    '/community/:documentId/objects',
    documentParams,
    validatedQuery(communityObjectQuerySchema),
    (context) =>
      communityRoute(context, async () => {
        const { documentId } = context.req.valid('param')
        const { checksum, version } = context.req.valid('query')
        const bytes = await community.object(documentId, checksum, version)
        if (!bytes) return notFound(context)
        context.header('Cache-Control', 'public, max-age=300')
        context.header('Content-Type', 'application/octet-stream')
        context.header('X-Content-Type-Options', 'nosniff')
        context.header('Content-Security-Policy', "default-src 'none'; sandbox")
        context.header('Cross-Origin-Resource-Policy', 'cross-origin')
        return context.body(new Uint8Array(bytes))
      })
  )
}

/**
 * Gallery thumbnails, for pages and apps on any origin. Each address names the revision it shows,
 * so a copy never goes stale, but it is cached only as long as the listing is: a document taken
 * down or out of the gallery stops showing everywhere within minutes.
 */
export function createCommunityThumbnailRoutes(community: CommunityService) {
  return new Hono().get(
    `${COMMUNITY_THUMBNAIL_PATH}/:documentId/:revisionId`,
    documentRevisionParams,
    (context) =>
      communityRoute(context, async () => {
        const { documentId, revisionId } = context.req.valid('param')
        const thumbnail = await community.thumbnail(documentId, revisionId)
        if (!thumbnail) return notFound(context)
        context.header('Cache-Control', 'public, max-age=300')
        context.header('Content-Type', 'image/png')
        context.header('X-Content-Type-Options', 'nosniff')
        context.header('Content-Security-Policy', "default-src 'none'; sandbox")
        context.header('Cross-Origin-Resource-Policy', 'cross-origin')
        return context.body(new Uint8Array(thumbnail))
      })
  )
}
