import type { TimestampColumn } from '#cloud/server/db/tables'
import type { Generated } from 'kysely'

/**
 * The OAuth provider's tables as far as Cloud reads them, built by migration `019_oauth`, and the
 * workspace picks Cloud keeps beside them; `CloudDatabase` lists them with the rest.
 */

/** An app registered with the OAuth provider; only what Cloud itself reads. */
export interface OAuthClientTable {
  id: string
  clientId: string
  name: string | null
  uri: string | null
  icon: string | null
  disabled: boolean | null
}

/** An app's access token, kept as its SHA-256 digest by the OAuth provider. */
export interface OAuthAccessTokenTable {
  id: string
  token: string
  clientId: string
  userId: string | null
  referenceId: string | null
  resources: string[] | null
  scopes: string[]
  expiresAt: TimestampColumn
  revoked: TimestampColumn | null
}

export interface OAuthRefreshTokenTable {
  id: string
  clientId: string
  userId: string
  referenceId: string | null
  revoked: TimestampColumn | null
}

/** What a person approved for an app: its scopes, for the workspace in `referenceId`. */
export interface OAuthConsentTable {
  id: string
  clientId: string
  userId: string | null
  referenceId: string | null
  scopes: string[]
  createdAt: TimestampColumn
  updatedAt: TimestampColumn
}

/** The workspace a person picked, in one session, for the app they are connecting. */
export interface OAuthWorkspaceChoiceTable {
  sessionId: string
  userId: string
  workspaceId: string
  chosenAt: Generated<Date>
}
