import type { CloudAPIEnvironment } from '#cloud/server/api/types'
import type { CloudDatabase } from '#cloud/server/db'
import type { Context, Env, Input } from 'hono'
import { rateLimiter, type RateLimitExceededEventHandler } from 'hono-rate-limiter'
import { matchedRoutes } from 'hono/route'
import type { Kysely } from 'kysely'

import { trustedClientIP, type ClientIdentityOptions } from './keys'
import { PostgresRateLimitStore } from './postgres'

export type RateLimitPolicy = {
  namespace: string
  windowMs: number
  limit: number
}

export const CLOUD_RATE_LIMITS = {
  publicCapability: { namespace: 'public-capability', windowMs: 60_000, limit: 30 },
  collaborationTicket: { namespace: 'collaboration-ticket', windowMs: 60_000, limit: 60 },
  invitationMutation: { namespace: 'invitation-mutation', windowMs: 60_000, limit: 30 },
  workspaceCreation: { namespace: 'workspace-creation', windowMs: 60_000, limit: 30 },
  documentCreation: { namespace: 'document-creation', windowMs: 60_000, limit: 60 },
  uploadCreation: { namespace: 'upload-creation', windowMs: 60_000, limit: 120 },
  authenticatedMutation: { namespace: 'authenticated-mutation', windowMs: 60_000, limit: 120 },
  aiToken: { namespace: 'ai-token', windowMs: 60_000, limit: 30 },
  adminRead: { namespace: 'admin-read', windowMs: 60_000, limit: 300 },
  adminMutation: { namespace: 'admin-mutation', windowMs: 60_000, limit: 30 }
} as const satisfies Record<string, RateLimitPolicy>

/**
 * The limiters routes mount for their own budget, each with which requests it counts. A general
 * limiter leaves those requests to it rather than counting them twice; the routes themselves say
 * which have one, so the general limiter never matches paths.
 */
const routeBudgets = new WeakMap<object, (context: Context) => boolean>()

/** Whether a limiter the request's route mounts for its own budget counts this request. */
export function routeHasOwnBudget(context: Context): boolean {
  return matchedRoutes(context).some((route) => routeBudgets.get(route.handler)?.(context))
}

function ownBudget<Limiter extends object>(
  limiter: Limiter,
  skip?: (context: Context) => boolean
): Limiter {
  routeBudgets.set(limiter, (context) => !skip?.(context))
  return limiter
}

type RateLimitOptions<E extends Env, P extends string, I extends Input> = {
  database: Kysely<CloudDatabase>
  secret: string
  policy: RateLimitPolicy
  keyGenerator(context: Context<E, P, I>): string
  handler?: RateLimitExceededEventHandler<E, P, I>
  skip?: (context: Context<E, P, I>) => boolean
  standardHeaders?: boolean | 'draft-6' | 'draft-7'
}

export function createCloudRateLimiter<
  E extends Env = Env,
  P extends string = string,
  I extends Input = Input
>(options: RateLimitOptions<E, P, I>) {
  return rateLimiter<E, P, I>({
    windowMs: options.policy.windowMs,
    limit: options.policy.limit,
    standardHeaders: options.standardHeaders ?? 'draft-7',
    store: new PostgresRateLimitStore(options.database, options.secret, options.policy.namespace),
    keyGenerator: (context) => options.keyGenerator(context),
    handler: options.handler
      ? (context, next, used) => options.handler?.(context, next, used)
      : undefined,
    skip: options.skip
  })
}

export function createTrustedIPRateLimiter(
  database: Kysely<CloudDatabase>,
  secret: string,
  policy: RateLimitPolicy,
  client: ClientIdentityOptions,
  handler?: RateLimitExceededEventHandler,
  options?: {
    resource?: (context: Context) => string
    skip?: (context: Context) => boolean
    /** The limiter is a route's own budget, which general limiters leave to it. */
    route?: boolean
  }
) {
  const limiter = createCloudRateLimiter({
    database,
    secret,
    policy,
    keyGenerator: (context) => {
      const ip = trustedClientIP(context, client) ?? 'unavailable'
      return options?.resource ? `resource:${options.resource(context)}:ip:${ip}` : `ip:${ip}`
    },
    skip: (context) =>
      trustedClientIP(context, client) === null || Boolean(options?.skip?.(context)),
    handler
  })
  return options?.route ? ownBudget(limiter, options.skip) : limiter
}

export function createActorRateLimiter(
  database: Kysely<CloudDatabase>,
  secret: string,
  policy: RateLimitPolicy,
  skip?: (context: Context) => boolean,
  resource?: (context: Context<CloudAPIEnvironment, '*'>) => string
) {
  return createCloudRateLimiter<CloudAPIEnvironment, '*'>({
    database,
    secret,
    policy,
    keyGenerator: (context) =>
      resource
        ? `resource:${resource(context)}:actor:${context.get('actor').userId}`
        : `actor:${context.get('actor').userId}`,
    skip
  })
}

/**
 * A limiter a route mounts for its own budget, such as document creation; general limiters leave
 * the requests it counts to it.
 */
export function createRouteRateLimiter(
  database: Kysely<CloudDatabase>,
  secret: string,
  policy: RateLimitPolicy,
  skip?: (context: Context) => boolean,
  resource?: (context: Context<CloudAPIEnvironment, '*'>) => string
) {
  return ownBudget(createActorRateLimiter(database, secret, policy, skip, resource), skip)
}
