import { CLOUD_EMBED_PATH, COMMUNITY_SITEMAP_PATH, COMMUNITY_THUMBNAIL_PATH } from '#cloud/contract'
import type { MiddlewareHandler } from 'hono'
import { METHOD_NAME_ALL } from 'hono/router'
import { TrieRouter } from 'hono/router/trie-router'

export type IndexingPolicy = 'allow' | 'deny'

/**
 * The server's own sections, which search engines never list: each path and everything under it.
 * An embed is one, as the page around its frame is the one to index.
 */
const PRIVATE_SECTIONS = [
  '/admin',
  '/account',
  '/app',
  '/api',
  '/auth',
  '/sign-in',
  '/sign-up',
  '/join',
  CLOUD_EMBED_PATH,
  '/.well-known'
]

/** A community document in the editor; its page at `/community/:id` is the one to index. */
const UNLISTED_PAGES = ['/community/:documentId/open', '/community/:documentId/open/']

/** Gallery thumbnails, under a private section: the previews its pages show and links fetch. */
const OPEN_ROUTE = `${COMMUNITY_THUMBNAIL_PATH}/*`

/**
 * Tells search engines to leave responses out: all of them under `deny`, otherwise the server's
 * own sections and unlisted pages, less the open route, matched by Hono's router as routes are. A
 * response passed on from `fetch` has headers nobody may change, so the header goes on a copy.
 */
export function preventIndexing(policy: IndexingPolicy): MiddlewareHandler {
  const router = new TrieRouter<'closed' | 'open'>()
  const closed =
    policy === 'deny' ? ['*'] : [...PRIVATE_SECTIONS.map((path) => `${path}/*`), ...UNLISTED_PAGES]
  for (const route of closed) router.add(METHOD_NAME_ALL, route, 'closed')
  if (policy === 'allow') router.add(METHOD_NAME_ALL, OPEN_ROUTE, 'open')
  return async (context, next) => {
    await next()
    const matches = router.match(METHOD_NAME_ALL, context.req.path)[0].map(([match]) => match)
    if (matches.length === 0 || matches.includes('open')) return
    const response = new Response(context.res.body, context.res)
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
    context.res = response
  }
}

/**
 * What `/robots.txt` answers: everything closed, or only the server's own sections, with the
 * gallery's thumbnails left open for link previews and, where the deployment has a gallery, its
 * sitemap at `origin`.
 */
export function robotsText(policy: IndexingPolicy, sitemapOrigin: string | null = null): string {
  if (policy === 'deny') return 'User-agent: *\nDisallow: /\n'
  const rules = [
    'User-agent: *',
    `Allow: ${COMMUNITY_THUMBNAIL_PATH}/`,
    ...PRIVATE_SECTIONS.map((path) => `Disallow: ${path}`),
    ...(sitemapOrigin
      ? ['', `Sitemap: ${new URL(COMMUNITY_SITEMAP_PATH, sitemapOrigin).href}`]
      : [])
  ]
  return `${rules.join('\n')}\n`
}
