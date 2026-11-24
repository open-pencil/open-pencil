import { CLOUD_COMMUNITY_PATH, cloudCommunityPagePath } from '#cloud/contract'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { communityDocuments, type CommunityPageFailure } from './page'

type API = { fetch(request: Request): Response | Promise<Response> }

const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'

/**
 * The gallery's pages on the deployment's public `origin` as a sitemap (sitemaps.org), with when
 * each document last changed, or why
 * there is none. Vue's server renderer writes the XML, escaping every value it holds.
 */
export async function communitySitemap(
  api: API,
  request: Request,
  origin: string
): Promise<string | CommunityPageFailure> {
  const documents = await communityDocuments(api, request)
  if (!Array.isArray(documents)) return documents
  const entry = (path: string, modified?: string) =>
    h('url', [h('loc', new URL(path, origin).href), modified ? h('lastmod', modified) : null])
  const app = createSSRApp({
    render: () =>
      h('urlset', { xmlns: SITEMAP_NAMESPACE }, [
        entry(CLOUD_COMMUNITY_PATH, documents.at(0)?.updatedAt),
        ...documents.map((document) =>
          entry(cloudCommunityPagePath(document.id), document.updatedAt)
        )
      ])
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n${await renderToString(app)}`
}
