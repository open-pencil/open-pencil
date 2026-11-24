import type { CloudTokenScope } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { ORPCError } from '@orpc/client'
import type { Context, MiddlewareHandler } from 'hono'
import { matchedRoutes } from 'hono/route'
import { TrieRouter } from 'hono/router/trie-router'
import type { Kysely } from 'kysely'

/**
 * What a route works on, which decides how far an app's grant reaches into it: a workspace, a
 * document, or an upload are checked against the grant's workspace; the account's own lists are
 * closed to apps unless the route narrows them to the grant itself.
 */
export type TokenRouteTarget = 'account' | 'workspace' | 'document' | 'upload'

export type TokenRoute = {
  scope: CloudTokenScope
  target: TokenRouteTarget
  /** For an account route: whether it answers an app with its grant's workspace alone. */
  narrowsToGrant: boolean
}

/** Whether an app's grant reaches the workspace, document, or upload a route names. */
export type GrantReach = (
  target: Exclude<TokenRouteTarget, 'account'>,
  id: string
) => Promise<boolean>

/**
 * What a declaring middleware reads, which every API route's environment has: the route's
 * parameters, which its `validatedParams` validator checked before it.
 */
type TokenRouteEnvironment = {
  Variables: { actor?: CloudActor; grantReach?: GrantReach }
}

/** Each declaring middleware's declaration, found again through the routes a request matched. */
const declared = new WeakMap<object, TokenRoute>()

const PARAMETERS: Record<Exclude<TokenRouteTarget, 'account'>, string> = {
  workspace: 'workspaceId',
  document: 'documentId',
  upload: 'uploadId'
}

/** Whether an app's grant reaches the workspace, document, or upload a route names. */
export async function grantReaches(
  database: Kysely<CloudDatabase>,
  workspaceId: string,
  target: Exclude<TokenRouteTarget, 'account'>,
  id: string
): Promise<boolean> {
  if (target === 'workspace') return id === workspaceId
  const query =
    target === 'document'
      ? database.selectFrom('document').select('document.workspaceId').where('document.id', '=', id)
      : database
          .selectFrom('upload')
          .innerJoin('document', 'document.id', 'upload.documentId')
          .select('document.workspaceId')
          .where('upload.id', '=', id)
  const row = await query.executeTakeFirst()
  return row?.workspaceId === workspaceId
}

type ValidatedParams = { out: { param: Partial<Record<string, string>> } }

function declare(
  route: TokenRoute
): MiddlewareHandler<TokenRouteEnvironment, string, ValidatedParams> {
  const middleware: MiddlewareHandler<TokenRouteEnvironment, string, ValidatedParams> = async (
    context,
    next
  ) => {
    const grant = context.get('actor')?.grant
    if (!grant || route.target === 'account') return next()
    const reach = context.get('grantReach')
    const id = context.req.valid('param')[PARAMETERS[route.target]]
    // A grant reaches only its own workspace; anything outside it is answered as absent.
    if (!reach || !id || !(await reach(route.target, id))) {
      return context.json({ error: { code: 'not_found' as const } }, 404)
    }
    return next()
  }
  declared.set(middleware, route)
  return middleware
}

/**
 * The declarations a route takes for `scope`: what it works on, and for an account route whether it
 * answers an app with its grant's workspace alone.
 */
function routesFor(scope: CloudTokenScope) {
  const account: TokenRoute = { scope, target: 'account', narrowsToGrant: false }
  return {
    account,
    /**
     * A route that shares documents or manages people, which personal access tokens reach and
     * apps never do, whatever their grant: an app works on documents, not on who sees them.
     */
    personal: account,
    /** An account route that answers an app with its grant's workspace alone. */
    grant: { scope, target: 'account', narrowsToGrant: true } satisfies TokenRoute,
    workspace: { scope, target: 'workspace', narrowsToGrant: false } satisfies TokenRoute,
    document: { scope, target: 'document', narrowsToGrant: false } satisfies TokenRoute,
    upload: { scope, target: 'upload', narrowsToGrant: false } satisfies TokenRoute
  }
}

/**
 * What tokens a route takes, as data: what a contract route declares (`contractTokenRoutes`). A
 * route without one takes a signed-in session alone.
 */
export const tokenRoutes = {
  read: routesFor('documents:read'),
  write: routesFor('documents:write')
}

/** The routes a token reaches, each declared on a Hono route itself after its parameters. */
function declarations(routes: ReturnType<typeof routesFor>) {
  return {
    account: declare(routes.account),
    personal: declare(routes.personal),
    grant: declare(routes.grant),
    workspace: declare(routes.workspace),
    document: declare(routes.document),
    upload: declare(routes.upload)
  }
}

/**
 * The routes a token reaches, each declared on the route itself after its parameters: what scope
 * it takes and what it works on. A route without one takes a signed-in session alone, so a route
 * added later stays closed to tokens until it says otherwise (`requireActiveActor`).
 */
export const tokenRoute = {
  read: declarations(tokenRoutes.read),
  write: declarations(tokenRoutes.write)
}

/** A contract route's token declaration, by its HTTP method and path. */
export type ContractTokenRoute = { method: string; path: `/${string}`; route: TokenRoute }

/**
 * Finds the declaration of the contract route a request reached, as Hono's router would match its
 * method and path; contract routes are served together, so their declarations are not routes.
 */
export function contractTokenRoutes(routes: readonly ContractTokenRoute[]) {
  const router = new TrieRouter<TokenRoute>()
  for (const { method, path, route } of routes) {
    router.add(method, path.replace(/\{(\+?)(\w+)\}/g, ':$2'), route)
  }
  return (context: Context): TokenRoute | undefined =>
    router.match(context.req.method, context.req.path)[0][0]?.[0]
}

/** Whether `input` carries route parameters, as a contract route's input does. */
function routeParameters(input: unknown): Partial<Record<string, unknown>> {
  if (typeof input !== 'object' || input === null || !('params' in input)) return {}
  const { params } = input
  return typeof params === 'object' && params !== null ? params : {}
}

/**
 * Holds an app's token to its grant on contract routes, as `tokenRoute` does on Hono routes: the
 * workspace, document, or upload a route names must be within it, or the route answers as if it
 * were absent. `routes` are the declarations of one contract's procedures, by name.
 */
export function grantReach(routes: Partial<Record<string, TokenRoute>>) {
  return async <T>(
    options: {
      path: readonly string[]
      context: { actor: CloudActor; grantReach?: GrantReach }
      next: () => Promise<T>
    },
    input: unknown
  ): Promise<T> => {
    const route = routes[options.path.at(-1) ?? '']
    if (!options.context.actor.grant || !route || route.target === 'account') {
      return options.next()
    }
    const reach = options.context.grantReach
    const id = routeParameters(input)[PARAMETERS[route.target]]
    if (!reach || typeof id !== 'string' || !(await reach(route.target, id))) {
      throw new ORPCError('not_found')
    }
    return options.next()
  }
}

/** The token declaration of the route a request reached, when it has one. */
export function declaredTokenRoute(context: Context): TokenRoute | undefined {
  for (const route of matchedRoutes(context)) {
    const declaration = declared.get(route.handler)
    if (declaration) return declaration
  }
  return undefined
}

/** Whether a token's scopes cover the one a route takes; writing includes reading. */
export function scopesAllow(scopes: readonly CloudTokenScope[], needed: CloudTokenScope): boolean {
  return (
    scopes.includes(needed) || (needed === 'documents:read' && scopes.includes('documents:write'))
  )
}

export type TokenRouteRefusal = 'not-declared' | 'insufficient-scope' | 'outside-grant'

/** Why a token may not take the route it reached, or undefined when it may. */
export function refuseTokenRoute(
  actor: CloudActor,
  route: TokenRoute | undefined
): TokenRouteRefusal | undefined {
  if (!route) return 'not-declared'
  if (!scopesAllow(actor.scopes ?? [], route.scope)) return 'insufficient-scope'
  if (actor.grant && route.target === 'account' && !route.narrowsToGrant) return 'outside-grant'
  return undefined
}

/** What a signed-in contract route knows of its request: the actor, and an app's grant reach. */
export type SignedInProcedureContext = { actor: CloudActor; grantReach?: GrantReach }
