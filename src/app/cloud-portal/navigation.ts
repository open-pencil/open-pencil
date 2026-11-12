import type { LocationQuery, RouteLocationRaw, RouteMeta } from 'vue-router'

import { cloudRedirectPath } from '@open-pencil/cloud/client'
import type { CloudAccountStatus } from '@open-pencil/cloud/contract'

/** Where signed-in people land when nothing else asked for them: the editor. */
export const PORTAL_HOME = '/'

/** The signed-in person's own settings, where a page they may not open sends them. */
export const ACCOUNT_PAGE = '/account'

/** A same-origin path to continue to after a sign-in step, from a `redirect` query value. */
export function continuationPath(value: unknown): string {
  return cloudRedirectPath(value, PORTAL_HOME)
}

/** An absolute URL for a path on this server. */
export function portalURL(path: string): string {
  return new URL(path, globalThis.location.origin).href
}

/** An absolute URL on this server that keeps the continuation, for links sent by email. */
export function continuationURL(path: string, redirect: string): string {
  const url = new URL(path, globalThis.location.origin)
  if (redirect !== PORTAL_HOME) url.searchParams.set('redirect', redirect)
  return url.href
}

/** Where an account accepts the server's current terms, then goes on to what it asked for. */
export const TERMS_PAGE = '/account/terms'

const STANDING_PATHS: Record<CloudAccountStatus['state'], string | null> = {
  active: null,
  pending: '/account/pending',
  rejected: '/account/closed',
  revoked: '/account/closed',
  terms: TERMS_PAGE
}

const STANDING_PAGES = new Set(Object.values(STANDING_PATHS))

/** The page an account in this standing belongs on, or null when it may go anywhere. */
export function standingPath(account: CloudAccountStatus | null): string | null {
  if (!account) return null
  return STANDING_PATHS[account.state]
}

/** The parts of a route the portal's access rules read. */
export interface PortalRouteTarget {
  meta: RouteMeta
  path: string
  fullPath: string
  query: LocationQuery
}

/**
 * The page an account in this standing belongs on, keeping where it was going when that page
 * leads on, as accepting the terms does.
 */
function standingDestination(standing: string, continuation: string): RouteLocationRaw {
  return standing === TERMS_PAGE && continuation !== PORTAL_HOME
    ? { path: standing, query: { redirect: continuation } }
    : standing
}

/**
 * Where a navigation may go. Signed-out pages send signed-in people on; account pages ask for a
 * session; console pages ask for a deployment administrator. An account waiting for review, or
 * whose access was declined, only reaches the page that explains it, and one with terms to accept
 * reaches its terms first.
 */
export function portalDestination(
  to: PortalRouteTarget,
  account: CloudAccountStatus | null
): true | RouteLocationRaw {
  if (to.meta.signedOut && account) {
    const continuation = continuationPath(to.query.redirect)
    const standing = standingPath(account)
    return standing ? standingDestination(standing, continuation) : continuation
  }
  if (!to.meta.account) return true
  if (!account) return { name: 'sign-in', query: { redirect: to.fullPath } }
  const standing = standingPath(account)
  if (standing && to.path !== standing) return standingDestination(standing, to.fullPath)
  // An active account has nothing waiting or declined to read about.
  if (!standing && STANDING_PAGES.has(to.path)) return PORTAL_HOME
  if (to.meta.admin && account.user.deploymentRole !== 'admin') return ACCOUNT_PAGE
  return true
}
