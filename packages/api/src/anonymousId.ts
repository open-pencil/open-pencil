import type { Context } from 'hono'

export const INKLY_ANONYMOUS_ID_HEADER = 'X-Inkly-Anonymous-Id'

export function resolveAnonymousId(c: Context): string {
  const existing = c.req.header(INKLY_ANONYMOUS_ID_HEADER)?.trim()
  const anonymousId = existing && existing.length > 0 ? existing : crypto.randomUUID()
  c.header(INKLY_ANONYMOUS_ID_HEADER, anonymousId)
  return anonymousId
}
