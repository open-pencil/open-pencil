import type { Context, Next } from 'hono'

export function requireTrustedMutationOrigin(trustedOrigins: ReadonlySet<string>) {
  return async (context: Context, next: Next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(context.req.method)) return next()
    const origin = context.req.header('origin')
    if (!origin || !trustedOrigins.has(origin)) {
      return context.json({ error: { code: 'forbidden' as const } }, 403)
    }
    return next()
  }
}
