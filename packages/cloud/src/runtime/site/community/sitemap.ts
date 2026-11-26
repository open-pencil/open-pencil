import { CLOUD_COMMUNITY_PATH, cloudCommunityPagePath } from '#cloud/contract'
import XMLBuilder from 'fast-xml-builder'

import { communityDocuments, type CommunityPageFailure } from './page'

type API = { fetch(request: Request): Response | Promise<Response> }

const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'

/** Writes the sitemap's XML, escaping every value it holds. */
const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_' })

/**
 * The gallery's pages on the deployment's public `origin` as a sitemap (sitemaps.org), with when
 * each document last changed, or why there is none.
 */
export async function communitySitemap(
  api: API,
  request: Request,
  origin: string
): Promise<string | CommunityPageFailure> {
  const documents = await communityDocuments(api, request)
  if (!Array.isArray(documents)) return documents
  const url = [
    { loc: new URL(CLOUD_COMMUNITY_PATH, origin).href, lastmod: documents.at(0)?.updatedAt },
    ...documents.map((document) => ({
      loc: new URL(cloudCommunityPagePath(document.id), origin).href,
      lastmod: document.updatedAt
    }))
  ]
  const xml: string = builder.build({ urlset: { '@_xmlns': SITEMAP_NAMESPACE, url } })
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`
}
