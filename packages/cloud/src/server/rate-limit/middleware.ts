import type { CloudAPIEnvironment, RateLimitUse } from '#cloud/server/api/types'
import type { CloudDatabase } from '#cloud/server/db'
import type { Context, Env, Input, MiddlewareHandler } from 'hono'
import { rateLimiter, type RateLimitExceededEventHandler } from 'hono-rate-limiter'
import { every } from 'hono/combine'
import { matchedRoutes } from 'hono/route'
import type { Kysely } from 'kysely'

import { trustedClientIP, type ClientIdentityOptions } from './keys'
import { PostgresRateLimitStore } from './postgres'

export type RateLimitPolicy = {
  namespace: string
  windowMs: number
  limit: number
}

/**
 * A budget counted per resource, such as a document, with `actorLimit` capping one actor across
 * every resource, so new resources do not add budget without end.
 */
export type ResourceRateLimitPolicy = RateLimitPolicy & { actorLimit: number }

export const CLOUD_RATE_LIMITS = {
  publicCapability: { namespace: 'public-capability', windowMs: 60_000, limit: 30 },
  collaborationTicket: {
    namespace: 'collaboration-ticket',
    windowMs: 60_000,
    limit: 60,
    actorLimit: 300
  },
  invitationMutation: {
    namespace: 'invitation-mutation',
    windowMs: 60_000,
    limit: 30,
    actorLimit: 60
  },
  workspaceCreation: { namespace: 'workspace-creation', windowMs: 60_000, limit: 30 },
  documentCreation: {
    namespace: 'document-creation',
    windowMs: 60_000,
    limit: 60,
    actorLimit: 120
  },
  uploadCreation: { namespace: 'upload-creation', windowMs: 60_000, limit: 120, actorLimit: 600 },
  authenticatedMutation: { namespace: 'authenticated-mutation', windowMs: 60_000, limit: 120 },
  servicesToken: { namespace: 'services-token', windowMs: 60_000, limit: 30 },
  adminRead: { namespace: 'admin-read', windowMs: 60_000, limit: 300 },
  adminMutation: { namespace: 'admin-mutation', windowMs: 60_000, limit: 30 }
} as const satisfies Record<string, RateLimitPolicy | ResourceRateLimitPolicy>

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
 * A limiter a route mounts for its own budget, such as workspace creation; general limiters leave
 * the requests it counts to it.
 */
export function createRouteRateLimiter(
  database: Kysely<CloudDatabase>,
  secret: string,
  policy: RateLimitPolicy,
  skip?: (context: Context) => boolean
) {
  return ownBudget(createActorRateLimiter(database, secret, policy, skip), skip)
}

/**
 * A route's own budget counted per resource, such as uploads per document, and capped per actor
 * across resources by `actorLimit`; general limiters leave the requests it counts to it.
 */
export function createResourceRateLimiter(
  database: Kysely<CloudDatabase>,
  secret: string,
  policy: ResourceRateLimitPolicy,
  resource: (context: Context<CloudAPIEnvironment, '*'>) => string,
  skip?: (context: Context) => boolean
) {
  const perResource = createActorRateLimiter(database, secret, policy, skip, resource)
  const perActor = createActorRateLimiter(
    database,
    secret,
    { namespace: `${policy.namespace}-actor`, windowMs: policy.windowMs, limit: policy.actorLimit },
    skip
  )
  return ownBudget(
    every(perResource, keepResourceUse, perActor, reportTighterBudget(policy.windowMs)),
    skip
  )
}

/** Keeps the resource budget's use, which the actor-wide limiter would record over. */
const keepResourceUse: MiddlewareHandler<CloudAPIEnvironment> = async (context, next) => {
  context.set('resourceRateLimit', context.get('rateLimit'))
  await next()
}

/**
 * Reports whichever budget has fewer requests left in the `RateLimit` headers, as both limiters
 * write them and the last would otherwise win. A refused request keeps the headers of the budget
 * that refused it.
 */
function reportTighterBudget(windowMs: number): MiddlewareHandler<CloudAPIEnvironment> {
  return async (context, next) => {
    const resource = context.get('resourceRateLimit')
    const actor = context.get('rateLimit')
    const tighter = resource && actor && resource.remaining < actor.remaining ? resource : actor
    if (tighter) setBudgetHeaders(context, tighter, windowMs)
    await next()
  }
}

/** The draft-7 `RateLimit` headers `hono-rate-limiter` writes, for one budget's use. */
function setBudgetHeaders(context: Context, use: RateLimitUse, windowMs: number): void {
  const windowSeconds = Math.ceil(windowMs / 1000)
  const reset = use.resetTime
    ? Math.max(0, Math.ceil((use.resetTime.getTime() - Date.now()) / 1000))
    : windowSeconds
  context.header('RateLimit-Policy', `${use.limit};w=${windowSeconds}`)
  context.header('RateLimit', `limit=${use.limit}, remaining=${use.remaining}, reset=${reset}`)
}

/**
 * A limiter's resource named by a route parameter, such as the document a request uploads to. It
 * runs before the route's param validator, and the value only names the limiter's counter, which
 * `rateLimitKey` hashes; it never reaches a query.
 */
export function routeParamResource(name: string) {
  return (context: Context): string =>
    // Lowercased as validation lowercases UUIDs, so one row's spellings share a budget.
    // eslint-disable-next-line @open-pencil/security/no-unvalidated-route-params -- a counter name, hashed, never queried.
    context.req.param(name)?.toLowerCase() ?? 'unknown'
}
