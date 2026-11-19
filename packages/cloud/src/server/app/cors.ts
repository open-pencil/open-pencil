import { CLOUD_DISCOVERY_PATH } from '#cloud/contract'
import type { MiddlewareHandler } from 'hono'
import { cors } from 'hono/cors'

/** The community gallery's addresses, which anyone may read from any page. */
const COMMUNITY_API_PATH = '/api/community'

/**
 * Whether an address is a public read any page may make: the server's discovery, and the
 * community gallery's list, documents, and thumbnails. They need no account, so they carry none.
 */
function isOpenRead(method: string, path: string): boolean {
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') return false
  return (
    path === CLOUD_DISCOVERY_PATH ||
    path === COMMUNITY_API_PATH ||
    path.startsWith(`${COMMUNITY_API_PATH}/`)
  )
}

/**
 * Cross-origin access to the server. Its own pages and the origins it trusts send their account
 * with every request. Any other page, such as the documentation site's landing showing the tour,
 * may read the discovery and the gallery without one, and nothing else.
 */
export function createCloudCORS(allowedOrigins: ReadonlySet<string>): MiddlewareHandler {
  const trusted = cors({
    origin: (origin) => (allowedOrigins.has(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 600
  })
  const openRead = cors({ origin: '*', allowMethods: ['GET', 'HEAD'], maxAge: 600 })
  return (context, next) => {
    const origin = context.req.header('Origin')
    const anyPage = origin !== undefined && !allowedOrigins.has(origin)
    // A preflight names the method it asks for; a request is its own.
    const method = context.req.header('Access-Control-Request-Method') ?? context.req.method
    return anyPage && isOpenRead(method, context.req.path)
      ? openRead(context, next)
      : trusted(context, next)
  }
}
