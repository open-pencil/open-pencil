import {
  CLOUD_COMMUNITY_PATH,
  cloudCommunityPagePath,
  communityDocumentsSchema,
  type CommunityDocument
} from '#cloud/contract'
// eslint-disable-next-line @open-pencil/structure/no-mixed-case-acronym-identifiers -- Upstream export spelling.
import { createHead, transformHtmlTemplate as transformHTMLTemplate } from 'unhead/server'
import * as v from 'valibot'

/** What a community page says about itself to link previews and search engines. */
export type PageMeta = {
  title: string
  description: string
  url: string
  image?: string
}

type API = { fetch(request: Request): Response | Promise<Response> }

/**
 * Why a community page shows no tags: there is no gallery or no such document (404), or the API
 * could not answer, such as when it limited the visitor, whose status and retry advice the page
 * keeps.
 */
export type CommunityPageFailure = { status: number; retryAfter: string | null }

/**
 * The gallery's documents, read through the server's own API as the visitor asked for the page,
 * so the request counts against the visitor's limits, or why they could not be read.
 */
async function communityDocuments(
  api: API,
  page: Request
): Promise<CommunityDocument[] | CommunityPageFailure> {
  const url = new URL(`/api${CLOUD_COMMUNITY_PATH}`, page.url)
  const response = await api.fetch(new Request(url, { headers: page.headers }))
  if (!response.ok) {
    return { status: response.status, retryAfter: response.headers.get('Retry-After') }
  }
  const body = v.safeParse(communityDocumentsSchema, await response.json())
  return body.success ? body.output.documents : { status: 502, retryAfter: null }
}

const NOT_FOUND: CommunityPageFailure = { status: 404, retryAfter: null }

/**
 * The tags for the gallery, or for one of its documents when `documentId` names one, or why the
 * page has none: no gallery or no such document, or an API that could not answer.
 */
export async function communityPageMeta(
  api: API,
  page: Request,
  documentId: string | undefined
): Promise<PageMeta | CommunityPageFailure> {
  const documents = await communityDocuments(api, page)
  if (!Array.isArray(documents)) return documents
  const { origin, host } = new URL(page.url)
  if (documentId === undefined) {
    const first = documents.at(0)
    return {
      title: `Community · ${host}`,
      description: 'Files to open, explore, and copy into your own workspace.',
      url: new URL(CLOUD_COMMUNITY_PATH, origin).href,
      image: first ? new URL(first.thumbnailPath, origin).href : undefined
    }
  }
  const document = documents.find((entry) => entry.id === documentId)
  if (!document) return NOT_FOUND
  return {
    title: `${document.name} · Community · ${host}`,
    description:
      document.versions.at(0)?.description ??
      `${document.name}, a file to open in OpenPencil and copy into your own workspace.`,
    url: new URL(cloudCommunityPagePath(document.id), origin).href,
    image: new URL(document.thumbnailPath, origin).href
  }
}

/** The page with the gallery's title, description, preview, and canonical address in its head. */
export async function withPageMeta(html: string, meta: PageMeta): Promise<string> {
  const head = createHead()
  head.push({
    title: meta.title,
    meta: [
      { name: 'description', content: meta.description },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: meta.title },
      { property: 'og:description', content: meta.description },
      { property: 'og:url', content: meta.url },
      ...(meta.image
        ? [
            { property: 'og:image', content: meta.image },
            { name: 'twitter:card', content: 'summary_large_image' }
          ]
        : [])
    ],
    link: [{ rel: 'canonical', href: meta.url }]
  })
  return transformHTMLTemplate(head, html)
}
