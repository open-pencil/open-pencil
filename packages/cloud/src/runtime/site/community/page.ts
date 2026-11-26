import {
  CLOUD_COMMUNITY_PATH,
  cloudCommunityPagePath,
  communityDocumentsSchema,
  type CommunityDocument
} from '#cloud/contract'
// eslint-disable-next-line @open-pencil/structure/no-mixed-case-acronym-identifiers -- Upstream export spelling.
import { createHead, transformHtmlTemplate as transformHTMLTemplate } from 'unhead/server'
import * as v from 'valibot'

import { communityContent, communityDocumentDescription } from './content'

/** What a community page says about itself to link previews and search engines. */
export type PageMeta = {
  title: string
  description: string
  url: string
  image?: string
}

/**
 * A community page as the server draws it: its head tags, and the gallery's documents with the one
 * the page shows, if it shows one, for what a crawler reads without running the page's script.
 */
export type CommunityPage = {
  meta: PageMeta
  origin: string
  documents: CommunityDocument[]
  document: CommunityDocument | null
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
export async function communityDocuments(
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

export const COMMUNITY_DESCRIPTION = 'Files to open, explore, and copy into your own workspace.'

/**
 * The gallery's page, or one of its documents' when `documentId` names one, with its addresses on
 * the deployment's public `origin`, or why there is none: no gallery or no such document, or an
 * API that could not answer.
 */
export async function communityPage(
  api: API,
  page: Request,
  origin: string,
  documentId: string | undefined
): Promise<CommunityPage | CommunityPageFailure> {
  const documents = await communityDocuments(api, page)
  if (!Array.isArray(documents)) return documents
  const { host } = new URL(origin)
  if (documentId === undefined) {
    const first = documents.at(0)
    return {
      meta: {
        title: `Community · ${host}`,
        description: COMMUNITY_DESCRIPTION,
        url: new URL(CLOUD_COMMUNITY_PATH, origin).href,
        image: first ? new URL(first.thumbnailPath, origin).href : undefined
      },
      origin,
      documents,
      document: null
    }
  }
  const document = documents.find((entry) => entry.id === documentId)
  if (!document) return NOT_FOUND
  return {
    meta: {
      title: `${document.name} · Community · ${host}`,
      description: communityDocumentDescription(document),
      url: new URL(cloudCommunityPagePath(document.id), origin).href,
      image: new URL(document.thumbnailPath, origin).href
    },
    origin,
    documents,
    document
  }
}

/** What the page is, as schema.org data for search engines. */
function structuredData({ meta, origin, documents, document }: CommunityPage) {
  if (document) {
    return {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: document.name,
      description: meta.description,
      url: meta.url,
      image: meta.image,
      dateModified: document.updatedAt,
      ...(document.versions[0] ? { version: document.versions[0].name } : {}),
      isAccessibleForFree: true
    }
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: meta.title,
    description: meta.description,
    url: meta.url,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: documents.map((entry, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: entry.name,
        url: new URL(cloudCommunityPagePath(entry.id), origin).href
      }))
    }
  }
}

const APP_ROOT = '<div id="app"></div>'

/**
 * The portal's page for the gallery or one of its documents: its title, description, preview,
 * canonical address, and structured data in its head, and what it shows drawn into the app's
 * root. The app replaces that content when it mounts; it is there for crawlers and link previews,
 * which read the page as served rather than as its script draws it.
 */
export async function renderCommunityPage(html: string, page: CommunityPage): Promise<string> {
  const { meta } = page
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
    link: [{ rel: 'canonical', href: meta.url }],
    script: [{ type: 'application/ld+json', textContent: structuredData(page) }]
  })
  // Vue's server renderer escapes every value it writes; a function replacement keeps `$`
  // patterns in names as they are.
  const content = await communityContent({
    documents: page.documents,
    document: page.document,
    description: meta.description
  })
  const filled = html.replace(APP_ROOT, () => `<div id="app">${content}</div>`)
  return transformHTMLTemplate(head, filled)
}
