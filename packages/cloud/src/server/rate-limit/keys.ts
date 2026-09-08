import type { CloudActor } from '#cloud/server/auth'
import type { Context } from 'hono'

export type ClientIdentityOptions = {
  trustedHeaders: string[]
}

export function trustedClientIP(context: Context, options: ClientIdentityOptions): string | null {
  for (const header of options.trustedHeaders) {
    const value = context.req.header(header)?.trim()
    if (value) return value
  }
  return null
}

export const rateLimitKey = {
  email(email: string): string {
    return `email:${email.trim().toLowerCase()}`
  },
  ip(ip: string): string {
    return `ip:${ip}`
  },
  actor(actor: CloudActor): string {
    return `actor:${actor.userId}`
  },
  resource(resourceId: string, identity: string): string {
    return `resource:${resourceId}:${identity}`
  }
}
