import type { CloudActor } from '#cloud/server/auth'
import type { Context } from 'hono'

export type ClientIdentityOptions = {
  trustedHeaders: string[]
}

/**
 * The client address a trusted proxy reported. List-valued headers such as `X-Forwarded-For` carry
 * whatever the client sent followed by what each proxy appended, so only the right-most entry,
 * the one the trusted proxy wrote, identifies the client.
 */
export function trustedClientIP(context: Context, options: ClientIdentityOptions): string | null {
  for (const header of options.trustedHeaders) {
    const value = context.req
      .header(header)
      ?.split(',')
      .map((entry) => entry.trim())
      .findLast((entry) => entry.length > 0)
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
