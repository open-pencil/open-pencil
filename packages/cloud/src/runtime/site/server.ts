import { CLOUD_PORTAL_COMMUNITY_PAGES, CLOUD_PORTAL_PAGE_ROOTS } from '#cloud/contract'
import {
  cloudErrorHandler,
  cloudRequestId,
  withIndexingPolicy,
  type CloudErrorReporter,
  type ForwardedRequestId
} from '#cloud/server'
import { Hono } from 'hono'

import { communityPageMeta, withPageMeta } from './community'

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
 * What the site's pages may run: only the site's own scripts and Turnstile's on the portal, so an
 * injected script tag or one from another host never runs. The pages carry no inline script (the
 * boot splash loads its own file). The editor compiles design JSX and code-tool snippets with
 * `Function` and runs WebAssembly and workers from blobs, which the policy keeps; plugins and AI
 * providers reach other hosts through `fetch`, which it leaves be. Desktop sign-in approval and
 * the editor must never be framed by another site.
 */
export const SITE_CONTENT_SECURITY_POLICY = [
  "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'"
].join('; ')

const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-cache',
  'Content-Security-Policy': SITE_CONTENT_SECURITY_POLICY,
  // Browsers take this only over HTTPS; a deployment on plain HTTP is unaffected.
  'Strict-Transport-Security': 'max-age=31536000',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
}

export type CloudServerOptions = {
  /** The built site; without it, the server answers only its API. */
  site?: SiteFiles
  indexingPolicy: 'allow' | 'deny'
  /** Reports errors reading the site's files, when the deployment configures error tracking. */
  reportError?: CloudErrorReporter
  /** The request ID the runtime trusts from what stands in front of it; see `cloudRequestId`. */
  forwardedRequestId?: ForwardedRequestId
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
  { site, indexingPolicy, reportError, forwardedRequestId }: CloudServerOptions
) {
  const server = new Hono()
    .onError(cloudErrorHandler(reportError))
    .use(cloudRequestId(forwardedRequestId))
  server.use(async (c, next) => {
    await next()
    c.res = withIndexingPolicy(c.res, c.req.path, indexingPolicy)
  })
  if (site) {
    const pages = CLOUD_PORTAL_PAGE_ROOTS.flatMap((root) => [root, `${root}/*`])
    server.on(['GET', 'HEAD'], pages, async (c) => {
      const page = await site(PORTAL_PAGE, c.req.raw)
      return page ? c.body(page.body, 200, PAGE_HEADERS) : c.notFound()
    })
    // The gallery's pages say what they show to link previews and search engines, which read the
    // page as served rather than as its script draws it.
    server.on(['GET', 'HEAD'], [...CLOUD_PORTAL_COMMUNITY_PAGES], async (c) => {
      const page = await site(PORTAL_PAGE, c.req.raw)
      if (!page) return c.notFound()
      const meta = await communityPageMeta(api, c.req.raw, c.req.param('documentId'))
      const html = await new Response(page.body).text()
      if ('title' in meta) return c.body(await withPageMeta(html, meta), 200, PAGE_HEADERS)
      // The page still loads and says what went wrong; the status and retry advice stay the API's.
      const headers = meta.retryAfter
        ? { ...PAGE_HEADERS, 'Retry-After': meta.retryAfter }
        : PAGE_HEADERS
      return new Response(html, { status: meta.status, headers })
    })
    server.on(['GET', 'HEAD'], '*', async (c, next) => {
      await next()
      if (c.res.status !== 404) return
      const file = await site(c.req.path, c.req.raw)
      if (file) {
        c.res = file.type.startsWith('text/html')
          ? new Response(file.body, { headers: PAGE_HEADERS })
          : new Response(file.body, {
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
      if (editor) c.res = new Response(editor.body, { headers: PAGE_HEADERS })
    })
  }
  server.all('*', (c) => api.fetch(c.req.raw))
  return server
}
