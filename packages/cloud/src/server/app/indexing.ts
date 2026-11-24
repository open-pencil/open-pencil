import { CLOUD_EMBED_PATH } from '#cloud/contract'
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

/**
 * Tells search engines to leave responses out: all of them under `deny`, otherwise the server's
 * own sections and unlisted pages, matched by Hono's router as routes are. A response passed on
 * from `fetch` has headers nobody may change, so the header goes on a copy.
 */
export function preventIndexing(policy: IndexingPolicy): MiddlewareHandler {
  const router = new TrieRouter<true>()
  const routes =
    policy === 'deny' ? ['*'] : [...PRIVATE_SECTIONS.map((path) => `${path}/*`), ...UNLISTED_PAGES]
  for (const route of routes) router.add(METHOD_NAME_ALL, route, true)
  return async (context, next) => {
    await next()
    if (router.match(METHOD_NAME_ALL, context.req.path)[0].length === 0) return
    const response = new Response(context.res.body, context.res)
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
    context.res = response
  }
}

/** What `/robots.txt` answers: everything closed, or only the server's own sections. */
export function robotsText(policy: IndexingPolicy): string {
  const closed = policy === 'deny' ? ['/'] : PRIVATE_SECTIONS
  return ['User-agent: *', ...closed.map((path) => `Disallow: ${path}`), ''].join('\n')
}
