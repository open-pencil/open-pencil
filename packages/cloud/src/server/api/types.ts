import type { CloudActor } from '#cloud/server/auth'
import type { GrantReach } from '#cloud/server/tokens'

/** What a rate limiter records on the request about the budget it just counted. */
export type RateLimitUse = { limit: number; remaining: number; resetTime?: Date }

export type CloudAPIEnvironment = {
  Variables: {
    actor: CloudActor
    /** Set by `cloudRequestId`: what logs and error reports name the request by. */
    requestId: string
    /** Set by `hono-rate-limiter` for the last budget it counted. */
    rateLimit?: RateLimitUse
    /** A resource budget's use, kept before the actor-wide budget records its own. */
    resourceRateLimit?: RateLimitUse
    /** Set for an app's grant: whether it reaches the workspace, document, or upload named. */
    grantReach?: GrantReach
  }
}
