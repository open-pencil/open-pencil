import {
  CLOUD_APP_ACCESS_TOKEN_PREFIX,
  CLOUD_TOKEN_SCOPES,
  cloudAPIResource,
  type CloudTokenScope
} from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { hashCapability } from '#cloud/server/sharing/crypto'
import type { Kysely } from 'kysely'

/** An app's access token in `Authorization: Bearer`, when the header carries one of Cloud's. */
export function bearerAppToken(headers: Headers): string | null {
  const token = headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
  return token?.startsWith(CLOUD_APP_ACCESS_TOKEN_PREFIX) ? token : null
}

const isTokenScope = (scope: string): scope is CloudTokenScope =>
  CLOUD_TOKEN_SCOPES.some((each) => each === scope)

/**
 * What an app's access token stands for: the account, the client, the workspace its grant
 * reaches, and its document scopes, while the token is live, its app enabled, its audience this
 * server's document API, and the account still in that workspace.
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
  return {
    userId: stored.userId,
    scopes: stored.scopes.filter(isTokenScope),
    grant: { clientId: stored.clientId, workspaceId: stored.referenceId }
  }
}
