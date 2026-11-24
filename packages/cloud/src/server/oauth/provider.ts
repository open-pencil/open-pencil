import {
  CLOUD_APP_ACCESS_TOKEN_PREFIX,
  CLOUD_APP_CLIENT_SECRET_PREFIX,
  CLOUD_APP_REFRESH_TOKEN_PREFIX,
  CLOUD_OAUTH_AUTHORIZE_PAGE,
  CLOUD_OAUTH_SCOPES,
  cloudAPIResource,
  cloudMCPResource
} from '#cloud/contract'
import { hashCapability } from '#cloud/server/sharing/crypto'
import { cimd } from '@better-auth/cimd'
import type { ClientMetadataResourceFetch, OAuthOptions, Scope } from '@better-auth/oauth-provider'
import { APIError } from 'better-auth'

import { chosenWorkspace } from './choices'

/** An access token's life; an app that asked for `offline_access` refreshes it. */
const ACCESS_TOKEN_SECONDS = 60 * 60
/** How long an app stays connected without using its refresh token. */
const REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60

/**
 * Better Auth's OAuth provider as Cloud runs it, the authorization server for apps people connect:
 *
 * - Apps register themselves (RFC 7591) as public clients with PKCE, as MCP clients such as
 *   ChatGPT, Claude, and Grok do, and get the document scopes alone.
 * - Every request goes through the approval page, first to pick the workspace the grant reaches
 *   (the plugin's post-login step) and then, the first time, to approve the scopes; the workspace
 *   becomes the grant's `referenceId`, which its tokens carry.
 * - Access tokens are opaque and kept as digests, so revoking a connection stops them at once;
 *   Cloud checks them itself (`resolveAppAccessToken`).
 */
export function cloudOAuthProviderOptions(publicURL: string): OAuthOptions<Scope[]> {
  const api = cloudAPIResource(publicURL)
  const mcp = cloudMCPResource(publicURL)
  return {
    scopes: [...CLOUD_OAUTH_SCOPES],
    grantTypes: ['authorization_code', 'refresh_token'],
    loginPage: CLOUD_OAUTH_AUTHORIZE_PAGE,
    consentPage: CLOUD_OAUTH_AUTHORIZE_PAGE,
    postLogin: {
      page: CLOUD_OAUTH_AUTHORIZE_PAGE,
      shouldRedirect: async () => !chosenWorkspace(),
      consentReferenceId: async () => {
        const workspaceId = chosenWorkspace()
        // The plugin asks for the reference before every consent and code; a grant always has one.
        if (!workspaceId) {
          throw new APIError('BAD_REQUEST', {
            error: 'invalid_request',
            error_description: 'Pick the workspace the app reaches'
          })
        }
        return workspaceId
      }
    },
    disableJwtPlugin: true,
    accessTokenExpiresIn: ACCESS_TOKEN_SECONDS,
    refreshTokenExpiresIn: REFRESH_TOKEN_SECONDS,
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    // A registration naming no type is a desktop app's when it redirects to loopback HTTP, as MCP
    // clients derive it (SEP-837), so those predating that derivation can register too.
    clientRegistrationDefaultApplicationType: 'infer',
    clientRegistrationDefaultScopes: [...CLOUD_OAUTH_SCOPES],
    // The document API, and the MCP endpoint that reaches the same documents for MCP clients.
    resources: [
      { identifier: api, name: 'OpenPencil Cloud API' },
      { identifier: mcp, name: 'OpenPencil Cloud MCP' }
    ],
    resourceSeedMode: 'merge',
    clientRegistrationDefaultResources: [api, mcp],
    // Apps are registered by themselves alone; nobody manages them through the plugin's endpoints.
    clientPrivileges: () => false,
    resourcePrivileges: () => false,
    storeTokens: { hash: async (token) => hashCapability(token) },
    prefix: {
      opaqueAccessToken: CLOUD_APP_ACCESS_TOKEN_PREFIX,
      refreshToken: CLOUD_APP_REFRESH_TOKEN_PREFIX,
      clientSecret: CLOUD_APP_CLIENT_SECRET_PREFIX
    }
  }
}

/**
 * Lets apps name the address of a metadata document they serve as their client ID instead of
 * registering, as MCP clients do (draft-ietf-oauth-client-id-metadata-document, MCP 2026-07-28),
 * where the runtime fetches those documents safely.
 */
export function clientMetadataPlugins(
  fetchClientMetadata: ClientMetadataResourceFetch | undefined
): ReturnType<typeof cimd>[] {
  if (!fetchClientMetadata) return []
  return [
    cimd({ fetchClientMetadataResource: fetchClientMetadata, metadataProfile: 'mcp-2026-07-28' })
  ]
}

type ProviderEndpoint = { path: string }
/** The OAuth provider plugin's endpoints, as far as Cloud names them. */
type CloudOAuthProvider = {
  endpoints: Record<string, ProviderEndpoint> & {
    oauth2Authorize: ProviderEndpoint
    oauth2Token: ProviderEndpoint
    oauth2Revoke: ProviderEndpoint
    registerOAuthClient: ProviderEndpoint
  }
}

/**
 * The plugin's endpoints apps call over HTTP: authorization, tokens, revocation, and registration.
 * Cloud's approval routes call the consent and continuation endpoints themselves, and every
 * other one, from client and consent management to introspection, stays closed.
 */
export function closedOAuthPaths(provider: CloudOAuthProvider): string[] {
  const open = new Set<string>([
    provider.endpoints.oauth2Authorize.path,
    provider.endpoints.oauth2Token.path,
    provider.endpoints.oauth2Revoke.path,
    provider.endpoints.registerOAuthClient.path
  ])
  return Object.values(provider.endpoints)
    .map((endpoint) => endpoint.path)
    .filter((path) => !open.has(path))
}
