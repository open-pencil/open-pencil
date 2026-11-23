import type { CloudTokenScope } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import type { Context, MiddlewareHandler } from 'hono'
import { matchedRoutes } from 'hono/route'
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

function declarations(scope: CloudTokenScope) {
  const account = declare({ scope, target: 'account', narrowsToGrant: false })
  return {
    account,
    /**
     * A route that shares documents or manages people, which personal access tokens reach and
     * apps never do, whatever their grant: an app works on documents, not on who sees them.
     */
    personal: account,
    /** An account route that answers an app with its grant's workspace alone. */
    grant: declare({ scope, target: 'account', narrowsToGrant: true }),
    workspace: declare({ scope, target: 'workspace', narrowsToGrant: false }),
    document: declare({ scope, target: 'document', narrowsToGrant: false }),
    upload: declare({ scope, target: 'upload', narrowsToGrant: false })
  }
}

/**
 * The routes a token reaches, each declared on the route itself after its parameters: what scope
 * it takes and what it works on. A route without one takes a signed-in session alone, so a route
 * added later stays closed to tokens until it says otherwise (`requireActiveActor`).
 */
export const tokenRoute = {
  read: declarations('documents:read'),
  write: declarations('documents:write')
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
