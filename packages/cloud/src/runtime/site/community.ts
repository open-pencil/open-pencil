import {
  CLOUD_COMMUNITY_PATH,
  cloudCommunityPagePath,
  communityDocumentsSchema,
  type CommunityDocument
} from '#cloud/contract'
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

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

function escapeHTML(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character)
}

/** The page with its title replaced and the preview and canonical tags added to its head. */
export function withPageMeta(html: string, meta: PageMeta): string {
  const tag = (attribute: 'name' | 'property', key: string, value: string) =>
    `<meta ${attribute}="${key}" content="${escapeHTML(value)}" />`
  const tags = [
    `<title>${escapeHTML(meta.title)}</title>`,
    tag('name', 'description', meta.description),
    `<link rel="canonical" href="${escapeHTML(meta.url)}" />`,
    tag('property', 'og:type', 'website'),
    tag('property', 'og:title', meta.title),
    tag('property', 'og:description', meta.description),
    tag('property', 'og:url', meta.url),
    ...(meta.image
      ? [
          tag('property', 'og:image', meta.image),
          tag('name', 'twitter:card', 'summary_large_image')
        ]
      : [])
  ].join('\n    ')
  // A function, so a `$` in a file's name is inserted as it is rather than read as a pattern.
  return html
    .replace(/<title>[^<]*<\/title>/, () => '')
    .replace('</head>', () => `    ${tags}\n  </head>`)
}
