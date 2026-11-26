import {
  CLOUD_EMBED_PATH,
  CLOUD_PORTAL_COMMUNITY_PAGES,
  CLOUD_PORTAL_PAGE_ROOTS,
  COMMUNITY_SITEMAP_PATH
} from '#cloud/contract'
import {
  cloudErrorHandler,
  cloudRequestId,
  preventIndexing,
  type CloudErrorReporter,
  type ForwardedRequestId,
  type IndexingPolicy
} from '#cloud/server'
import { Hono, type MiddlewareHandler } from 'hono'
import { secureHeaders } from 'hono/secure-headers'

import { communityPage, renderCommunityPage } from './community/page'
import { communitySitemap } from './community/sitemap'

/** A file of the Cloud site (`bun run build:cloud`): the editor and the portal. */
export type SiteFile = {
  body: ReadableStream | Uint8Array<ArrayBuffer>
  type: string
  /** Overrides the cache policy built files get, for a site whose files change in place. */
  cacheControl?: string
}

/** Reads the built site's file at a URL path, or null when there is none. */
export type SiteFiles = (path: string, request: Request) => Promise<SiteFile | null>

const PORTAL_PAGE = '/cloud.html'
const EDITOR_PAGE = '/index.html'

/**
 * The headers every page of the site carries, with who may frame it. Pages run only the site's
 * own scripts and Turnstile's on the portal, so an injected script tag or one from another host
 * never runs; they carry no inline script (the boot splash loads its own file). The editor compiles
 * design JSX and code-tool snippets with `Function` and runs WebAssembly and workers from blobs,
 * which the policy keeps; plugins and AI providers reach other hosts through `fetch`, which it
 * leaves be. Another site learns only Cloud's origin, never an address such as a share link's;
 * unlike `no-referrer` or `same-origin`, a form posted to one, as billing's sign-in is, still names
 * its origin there instead of `null`. `frame-ancestors` alone says who may frame a page, as
 * `X-Frame-Options` cannot name origins; a framed page lets other sites load it. Browsers take HSTS
 * only over HTTPS. The opener policy stays the browser's: OpenRouter's sign-in popup is closed by
 * the page that opened it, which a separate browsing context group would keep from it. DNS
 * prefetching stays on for the hosts the editor reaches.
 */
export function pageSecurity(frameAncestors: readonly string[]): MiddlewareHandler {
  const framed = !frameAncestors.includes("'none'")
  return secureHeaders({
    contentSecurityPolicy: {
      scriptSrc: [
        "'self'",
        "'unsafe-eval'",
        "'wasm-unsafe-eval'",
        'blob:',
        'https://challenges.cloudflare.com'
      ],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: [...frameAncestors]
    },
    strictTransportSecurity: 'max-age=31536000',
    referrerPolicy: 'strict-origin',
    xFrameOptions: false,
    crossOriginResourcePolicy: framed ? 'cross-origin' : true,
    crossOriginOpenerPolicy: false,
    xDnsPrefetchControl: false
  })
}

/**
 * Who may frame an embed: the listed origins, or any site. An embed only shows a document someone
 * could already open by its link, read-only and without the visitor's account, so nothing a
 * framing page could trick a click into changes anything.
 */
export function embedFrameAncestors(allowedOrigins: readonly string[]): string[] {
  return allowedOrigins.length === 0 ? ['*'] : allowedOrigins.map((url) => new URL(url).origin)
}

/** Desktop sign-in approval and the editor must never be framed by another site. */
const sitePageSecurity = pageSecurity(["'none'"])

const PAGE_HEADERS = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }

export type CloudServerOptions = {
  /** The built site; without it, the server answers only its API. */
  site?: SiteFiles
  indexingPolicy: IndexingPolicy
  /**
   * Where visitors reach the deployment: the gallery's canonical addresses, preview images, and
   * sitemap entries are named from it, never from the request, whose host may be one a proxy
   * forwards to.
   */
  publicURL: string
  /** Reports errors reading the site's files, when the deployment configures error tracking. */
  reportError?: CloudErrorReporter
  /** The request ID the runtime trusts from what stands in front of it; see `cloudRequestId`. */
  forwardedRequestId?: ForwardedRequestId
  /**
   * Who may show the server's documents in a frame at `/embed/…`: the listed origins, or any site
   * when the list is empty. Without it, those addresses are not found.
   */
  embedding?: { allowedOrigins: readonly string[] }
}

function cacheControl(path: string): string {
  if (path.startsWith('/assets/')) return 'public, max-age=31536000, immutable'
  return 'public, max-age=3600'
}

/**
 * A Cloud server as every runtime serves it: the portal's `cloud.html` at portal pages, the API
 * everywhere else, and, where the API has nothing, the site's files, or the editor's
 * `index.html` for any other page, whose router knows the editor's own addresses.
 */
export function createCloudServer(
  api: { fetch(request: Request): Response | Promise<Response> },
  {
    site,
    indexingPolicy,
    publicURL,
    reportError,
    forwardedRequestId,
    embedding
  }: CloudServerOptions
) {
  const server = new Hono()
    .onError(cloudErrorHandler(reportError))
    .use(cloudRequestId(forwardedRequestId))
  server.use(preventIndexing(indexingPolicy))
  const { origin } = new URL(publicURL)
  if (site) {
    const pages = CLOUD_PORTAL_PAGE_ROOTS.flatMap((root) => [root, `${root}/*`])
    server.on(['GET', 'HEAD'], pages, sitePageSecurity, async (c) => {
      const page = await site(PORTAL_PAGE, c.req.raw)
      return page ? c.body(page.body, 200, PAGE_HEADERS) : c.notFound()
    })
    // The gallery's pages say what they show to link previews and search engines, which read the
    // page as served rather than as its script draws it.
    server.on(['GET', 'HEAD'], [...CLOUD_PORTAL_COMMUNITY_PAGES], sitePageSecurity, async (c) => {
      const page = await site(PORTAL_PAGE, c.req.raw)
      if (!page) return c.notFound()
      const community = await communityPage(api, c.req.raw, origin, c.req.param('documentId'))
      const html = await new Response(page.body).text()
      if ('meta' in community) {
        return c.body(await renderCommunityPage(html, community), 200, PAGE_HEADERS)
      }
      // The page still loads and says what went wrong; the status and retry advice stay the API's.
      const headers = community.retryAfter
        ? { ...PAGE_HEADERS, 'Retry-After': community.retryAfter }
        : PAGE_HEADERS
      return new Response(html, { status: community.status, headers })
    })
    const embedPages = [CLOUD_EMBED_PATH, `${CLOUD_EMBED_PATH}/*`]
    if (embedding) {
      const embedSecurity = pageSecurity(embedFrameAncestors(embedding.allowedOrigins))
      server.on(['GET', 'HEAD'], embedPages, embedSecurity, async (c) => {
        const page = await site(EDITOR_PAGE, c.req.raw)
        return page ? c.body(page.body, 200, PAGE_HEADERS) : c.notFound()
      })
    } else {
      server.on(['GET', 'HEAD'], embedPages, (c) => c.notFound())
    }
    // The gallery's pages for search engines, on a deployment that lets them index it.
    if (indexingPolicy === 'allow') {
      server.get(COMMUNITY_SITEMAP_PATH, async (c) => {
        const sitemap = await communitySitemap(api, c.req.raw, origin)
        if (typeof sitemap === 'string') {
          return c.body(sitemap, 200, {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=300'
          })
        }
        // No gallery answers 404; a limited or failed read keeps the API's status and retry advice.
        const headers: Record<string, string> = sitemap.retryAfter
          ? { 'Retry-After': sitemap.retryAfter }
          : {}
        return new Response(null, { status: sitemap.status, headers })
      })
    }
    server.on(['GET', 'HEAD'], '*', async (c, next) => {
      await next()
      if (c.res.status !== 404) return
      const file = await site(c.req.path, c.req.raw)
      // Only pages carry the site's page headers: its policies would keep other sites, and the
      // desktop app, from loading its files.
      const answerPage = (body: SiteFile['body']) =>
        sitePageSecurity(c, async () => {
          c.res = new Response(body, { headers: PAGE_HEADERS })
        })
      if (file?.type.startsWith('text/html')) {
        await answerPage(file.body)
        return
      }
      if (file) {
        c.res = new Response(file.body, {
          headers: {
            'Content-Type': file.type,
            'Cache-Control': file.cacheControl ?? cacheControl(c.req.path),
            'X-Content-Type-Options': 'nosniff'
          }
        })
        return
      }
      if (!c.req.header('Accept')?.includes('text/html')) return
      const editor = await site(EDITOR_PAGE, c.req.raw)
      if (editor) await answerPage(editor.body)
    })
  }
  server.all('*', (c) => api.fetch(c.req.raw))
  return server
}
