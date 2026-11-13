import {
  COMMUNITY_THUMBNAIL_PATH,
  parseCommunityDownloadQuery,
  parseRequestImageLinks
} from '#cloud/contract'
import { documentDomainError } from '#cloud/server/documents'
import {
  communityThumbnailParams,
  documentParams,
  validatedJSON,
  validatedQuery
} from '#cloud/server/validation'
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
 * The community gallery's data for anyone, signed in or not: the list, a document or one of its
 * named versions to open read-only, and the links of its images. A deployment without a gallery
 * answers not found.
 */
export function createCommunityRoutes(community: CommunityService) {
  return new Hono()
    .get('/community', async (context) => {
      if (!community.enabled) return notFound(context)
      // The gallery changes on a publish; a few minutes' copy spares the database repeat visits.
      context.header('Cache-Control', 'public, max-age=300')
      return context.json({ documents: await community.list() })
    })
    .get(
      '/community/:documentId/document',
      documentParams,
      validatedQuery(parseCommunityDownloadQuery),
      (context) =>
        communityRoute(context, async () => {
          const { documentId } = context.req.valid('param')
          return context.json(
            await community.download(documentId, context.req.valid('query').version)
          )
        })
    )
    .post(
      '/community/:documentId/images',
      documentParams,
      validatedJSON(parseRequestImageLinks),
      (context) =>
        communityRoute(context, async () =>
          context.json(
            await community.imageLinks(
              context.req.valid('param').documentId,
              context.req.valid('json').checksums
            )
          )
        )
    )
}

/**
 * Gallery thumbnails, for pages and apps on any origin: each address names the revision it shows,
 * so a copy never goes stale and caches may keep it.
 */
export function createCommunityThumbnailRoutes(community: CommunityService) {
  return new Hono().get(
    `${COMMUNITY_THUMBNAIL_PATH}/:documentId/:revisionId`,
    communityThumbnailParams,
    (context) =>
      communityRoute(context, async () => {
        const { documentId, revisionId } = context.req.valid('param')
        const thumbnail = await community.thumbnail(documentId, revisionId)
        if (!thumbnail) return notFound(context)
        context.header('Cache-Control', 'public, max-age=31536000, immutable')
        context.header('Content-Type', 'image/png')
        context.header('X-Content-Type-Options', 'nosniff')
        context.header('Content-Security-Policy', "default-src 'none'; sandbox")
        context.header('Cross-Origin-Resource-Policy', 'cross-origin')
        return context.body(new Uint8Array(thumbnail))
      })
  )
}
