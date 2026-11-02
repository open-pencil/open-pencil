import { CLOUD_PORTAL_PAGE_ROOTS } from '#cloud/contract'
import { withIndexingPolicy } from '#cloud/server'
import { Hono } from 'hono'

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

const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-cache',
  // Desktop sign-in approval and the editor must never be framed by another site.
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
}

export type CloudServerOptions = {
  /** The built site; without it, the server answers only its API. */
  site?: SiteFiles
  indexingPolicy: 'allow' | 'deny'
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
  { site, indexingPolicy }: CloudServerOptions
) {
  const server = new Hono()
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
