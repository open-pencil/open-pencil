import * as v from 'valibot'

import { CLOUD_TOKEN_SCOPES, cloudTokenScopeSchema } from './account'

/**
 * Apps people connect to their account through OAuth, such as ChatGPT, Claude, or Grok: a server
 * that turns it on is their authorization server, and its document API the resource they reach.
 * An app's grant reaches one workspace, with the scopes the person approved.
 */

/** The scopes an app may ask for: the document scopes, and staying connected past an hour. */
export const CLOUD_OAUTH_SCOPES = [...CLOUD_TOKEN_SCOPES, 'offline_access'] as const

/** Prefixes on what the server hands apps, so a leaked one is recognised as Cloud's. */
export const CLOUD_APP_ACCESS_TOKEN_PREFIX = 'opa_'
export const CLOUD_APP_REFRESH_TOKEN_PREFIX = 'opr_'
export const CLOUD_APP_CLIENT_SECRET_PREFIX = 'ops_'

/** The page that signs a person in, asks which workspace an app gets, and asks their approval. */
export const CLOUD_OAUTH_AUTHORIZE_PAGE = '/auth/authorize'

/** Where an app finds what protects a resource (RFC 9728), with the resource's path after it. */
export const CLOUD_PROTECTED_RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource'
/** Where an app finds the authorization server (RFC 8414), with its issuer's path after it. */
export const CLOUD_AUTHORIZATION_SERVER_METADATA_PATH = '/.well-known/oauth-authorization-server'

/** The document API as a protected resource: what apps name in `resource`, and tokens' audience. */
export const cloudAPIResource = (publicURL: string) => new URL('/api', publicURL).href

const appSchema = v.object({
  clientId: v.string(),
  name: v.string(),
  /** The address the app gave for itself, as it registered; shown, never followed by the server. */
  uri: v.nullable(v.string()),
  icon: v.nullable(v.string())
})

/** An authorization request as the approval page shows it. */
export const cloudOAuthRequestSchema = v.object({
  app: appSchema,
  scopes: v.array(cloudTokenScopeSchema),
  /** Whether the app asked to stay connected after its first hour. */
  offline: v.boolean(),
  workspaces: v.array(v.object({ id: v.string(), name: v.string() }))
})
export const cloudOAuthRequestResponseSchema = v.object({ request: cloudOAuthRequestSchema })

/** The signed query the server sent the approval page, as the page got it. */
const oauthQuerySchema = v.pipe(v.string(), v.minLength(1), v.maxLength(8192))

export const cloudOAuthDecisionSchema = v.variant('decision', [
  v.object({
    decision: v.literal('allow'),
    query: oauthQuerySchema,
    workspaceId: v.pipe(v.string(), v.uuid())
  }),
  v.object({ decision: v.literal('deny'), query: oauthQuerySchema })
])
/** Where the browser goes next: back to the app, with a code or with the refusal. */
export const cloudOAuthDecisionResponseSchema = v.object({ redirect: v.pipe(v.string(), v.url()) })

/** An app the account connected, and the workspace it reaches. */
export const cloudAppConnectionSchema = v.object({
  id: v.string(),
  app: appSchema,
  workspace: v.object({ id: v.string(), name: v.string() }),
  scopes: v.array(cloudTokenScopeSchema),
  connectedAt: v.string()
})
export const cloudAppConnectionsResponseSchema = v.object({
  connections: v.array(cloudAppConnectionSchema)
})
export const cloudAppConnectionRevokeSchema = v.object({ id: v.pipe(v.string(), v.uuid()) })

export type CloudOAuthRequest = v.InferOutput<typeof cloudOAuthRequestSchema>
export type CloudOAuthDecision = v.InferOutput<typeof cloudOAuthDecisionSchema>
export type CloudAppConnection = v.InferOutput<typeof cloudAppConnectionSchema>
