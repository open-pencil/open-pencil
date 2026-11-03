import type { CloudActor } from '#cloud/server/auth'

/** What a rate limiter records on the request about the budget it just counted. */
export type RateLimitUse = { limit: number; remaining: number; resetTime?: Date }

export type CloudAPIEnvironment = {
  Variables: {
    actor: CloudActor
    /** Set by `hono-rate-limiter` for the last budget it counted. */
    rateLimit?: RateLimitUse
    /** A resource budget's use, kept before the actor-wide budget records its own. */
    resourceRateLimit?: RateLimitUse
  }
}
