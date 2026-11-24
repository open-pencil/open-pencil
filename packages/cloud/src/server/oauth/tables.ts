import type { TimestampColumn } from '#cloud/server/db/tables'

/**
 * The OAuth provider's tables as far as Cloud reads them, built by migration `019_oauth`;
 * `CloudDatabase` lists them with the rest.
 */

/** An app registered with the OAuth provider; only what Cloud itself reads. */
export interface OAuthClientTable {
  id: string
  clientId: string
  name: string | null
  uri: string | null
  icon: string | null
  tokenEndpointAuthMethod: string | null
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
  /** The key a DPoP-bound token is bound to (RFC 9449 `cnf`). */
  confirmation: unknown
  createdAt: TimestampColumn
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
