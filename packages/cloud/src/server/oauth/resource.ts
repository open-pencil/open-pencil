import {
  CLOUD_APP_ACCESS_TOKEN_PREFIX,
  CLOUD_TOKEN_SCOPES,
  cloudAPIResource,
  type CloudTokenScope
} from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { hashCapability } from '#cloud/server/sharing/crypto'
import { createResourceServerChallenge } from '@better-auth/oauth-provider'
import { APIError } from 'better-auth'
import { createInsufficientScopeError, parseAccessTokenAuthorization } from 'better-auth/oauth2'
import type { Kysely } from 'kysely'

/** An app's access token in `Authorization: Bearer`, when the header carries one of Cloud's. */
export function bearerAppToken(headers: Headers): string | null {
  const authorization = parseAccessTokenAuthorization(headers.get('authorization') ?? undefined)
  if (authorization?.scheme !== 'Bearer') return null
  return authorization.token.startsWith(CLOUD_APP_ACCESS_TOKEN_PREFIX) ? authorization.token : null
}

/**
 * The `WWW-Authenticate` challenge for the document API, as the OAuth provider builds it: without
 * a scope, a request lacking a valid token learns where to get one (RFC 9728 §5.1); with one, a
 * token lacking that scope learns what to ask the person for (RFC 6750 §3.1).
 */
export function resourceChallenge(publicURL: string, missingScope?: string): string | null {
  const error = missingScope
    ? createInsufficientScopeError([missingScope])
    : new APIError('UNAUTHORIZED')
  const challenge = createResourceServerChallenge(error, cloudAPIResource(publicURL))
  return challenge ? new Headers(challenge.headers).get('WWW-Authenticate') : null
}

const isTokenScope = (scope: string): scope is CloudTokenScope =>
  CLOUD_TOKEN_SCOPES.some((each) => each === scope)

/**
 * What an app's access token stands for: the account, the client, the workspace its grant
 * reaches, and its document scopes, while the token is live, its app enabled, its audience this
 * server's document API, the account still in that workspace, and the app still connected to it.
 *
 * The plugin also ties a token to the browser session that approved it and stops it when that
 * session ends; Cloud checks tokens itself and leaves that out, so signing out of the browser does
 * not disconnect an app. A connection ends when the person revokes it, leaves the workspace, or
 * the app stops refreshing; revoking marks every token of the grant revoked.
 */
export async function resolveAppAccessToken(
  database: Kysely<CloudDatabase>,
  publicURL: string,
  token: string
) {
  const stored = await database
    .selectFrom('oauthAccessToken')
    .innerJoin('oauthClient', 'oauthClient.clientId', 'oauthAccessToken.clientId')
    .select([
      'oauthAccessToken.userId',
      'oauthAccessToken.clientId',
      'oauthAccessToken.referenceId',
      'oauthAccessToken.resources',
      'oauthAccessToken.scopes',
      'oauthAccessToken.expiresAt',
      'oauthAccessToken.revoked',
      'oauthAccessToken.createdAt',
      'oauthAccessToken.confirmation',
      'oauthClient.disabled'
    ])
    .where(
      'oauthAccessToken.token',
      '=',
      hashCapability(token.slice(CLOUD_APP_ACCESS_TOKEN_PREFIX.length))
    )
    .executeTakeFirst()
  if (!stored?.userId || !stored.referenceId) return null
  if (stored.revoked || stored.disabled) return null
  // A token bound to a key (DPoP, RFC 9449) is good only with a proof of that key, which this
  // Bearer-only check does not take; the token endpoint binds one whenever the app sends a proof.
  if (stored.confirmation != null) return null
  if (new Date(stored.expiresAt).getTime() <= Date.now()) return null
  // A token for another resource is not for the document API (RFC 8707). One whose request named
  // none reaches this API, the only resource the server has.
  const resources = stored.resources ?? []
  if (resources.length > 0 && !resources.includes(cloudAPIResource(publicURL))) return null
  // The grant's workspace, kept as text by the provider, while the account still belongs to it.
  const member = await database
    .selectFrom('workspaceMember')
    .select('workspaceId')
    .where('workspaceId', '=', stored.referenceId)
    .where('userId', '=', stored.userId)
    .executeTakeFirst()
  if (!member) return null
  // The person's consent for this app and workspace, as it stands: a token issued before it, for a
  // connection since ended, stays dead after the app connects again, and a token reaches no scope
  // the person has since taken back.
  const consent = await database
    .selectFrom('oauthConsent')
    .select(['scopes', 'createdAt'])
    .where('clientId', '=', stored.clientId)
    .where('userId', '=', stored.userId)
    .where('referenceId', '=', stored.referenceId)
    .executeTakeFirst()
  if (!consent) return null
  if (new Date(stored.createdAt).getTime() < new Date(consent.createdAt).getTime()) return null
  return {
    userId: stored.userId,
    scopes: stored.scopes.filter(isTokenScope).filter((scope) => consent.scopes.includes(scope)),
    grant: { clientId: stored.clientId, workspaceId: stored.referenceId }
  }
}
