import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import {
  CLOUD_RATE_LIMITS,
  createActorRateLimiter,
  createTrustedIPRateLimiter,
  routeHasOwnBudget,
  type RateLimitPolicy
} from '#cloud/server/rate-limit'
import type { Kysely } from 'kysely'

/**
 * The app's rate limiters. The public ones count by trusted client IP and answer an exhausted
 * budget as not found, so a capability's existence never leaks; the authenticated one counts by
 * actor and leaves reads and routes with a budget of their own alone.
 */
export function createAppRateLimiters(database: Kysely<CloudDatabase>, config: CloudServerConfig) {
  /** A limiter for requests without an account, by trusted client IP. */
  const publicLimiter = (
    policy: RateLimitPolicy,
    options: Parameters<typeof createTrustedIPRateLimiter>[5]
  ) =>
    createTrustedIPRateLimiter(
      database,
      config.authSecret,
      policy,
      { trustedHeaders: config.authTrustedIPHeaders },
      (context) => context.json({ error: { code: 'not_found' as const } }, 404),
      options
    )

  return {
    publicRateLimiter: publicLimiter(CLOUD_RATE_LIMITS.publicCapability, {
      resource: (context) => context.req.path,
      // Guests refresh collaboration tickets on their own budget, `publicCollaborationLimiter`.
      skip: routeHasOwnBudget
    }),
    publicCollaborationLimiter: publicLimiter(CLOUD_RATE_LIMITS.collaborationTicket, {
      resource: (context) => context.req.path,
      route: true
    }),
    // The gallery's own budget, across its paths, in place of the per-path public one.
    communityLimiter: publicLimiter(CLOUD_RATE_LIMITS.communityRead, { route: true }),
    authenticatedMutationLimiter: createActorRateLimiter(
      database,
      config.authSecret,
      CLOUD_RATE_LIMITS.authenticatedMutation,
      // Reads are free, and a route with a budget of its own, such as creating documents, counts
      // against that instead.
      (context) => context.req.method === 'GET' || routeHasOwnBudget(context)
    )
  }
}
