import { createHash, timingSafeEqual } from 'node:crypto'

import {
  bearerAuthChallengeResponse,
  OAuthError,
  OAuthErrorCode
} from '@modelcontextprotocol/server'
import type { MiddlewareHandler } from 'hono'

/**
 * What a token opens. `mcp` is MCP sessions, where eval, the tool switches, the file root, and
 * the scope apply. The others reach past those settings: `rpc` sends raw commands to the app
 * (`/rpc`, and requests over the socket), `files` reads and writes under the root (`/files`), and
 * `app` registers as the app on the socket.
 */
export type MCPAccessScope = 'mcp' | 'rpc' | 'files' | 'app'

const SERVER_SCOPES: readonly MCPAccessScope[] = ['mcp', 'rpc', 'files', 'app']
const CLIENT_SCOPES: readonly MCPAccessScope[] = ['mcp']

/**
 * Who may do what. The server's token belongs to the app, the CLI, and the stdio bridge and opens
 * everything; the client token, given to MCP clients, opens `mcp` alone. Null tokens mean auth is
 * off, and then every caller gets every scope.
 */
export interface MCPAccess {
  /** The scopes a token opens; empty for an unknown token. */
  scopes(token: string | null): readonly MCPAccessScope[]
  /** Answers a request that lacks `scope` with the SDK's OAuth 401 or 403 challenge, or returns null. */
  refuse(authorization: string | null | undefined, scope: MCPAccessScope): Response | null
}

export function createMCPAccess(serverToken: string | null, clientToken: string | null): MCPAccess {
  function scopes(token: string | null): readonly MCPAccessScope[] {
    if (serverToken === null) return SERVER_SCOPES
    if (token === null) return []
    if (tokensMatch(token, serverToken)) return SERVER_SCOPES
    if (clientToken !== null && tokensMatch(token, clientToken)) return CLIENT_SCOPES
    return []
  }

  return {
    scopes,
    refuse(authorization, scope) {
      const granted = scopes(bearerToken(authorization))
      if (granted.includes(scope)) return null
      // Tokens are read whole, spaces included, so only the challenge comes from the SDK.
      const error =
        granted.length === 0
          ? new OAuthError(OAuthErrorCode.InvalidToken, 'Unknown token')
          : new OAuthError(OAuthErrorCode.InsufficientScope, 'Insufficient scope')
      return bearerAuthChallengeResponse(error, { requiredScopes: [scope] })
    }
  }
}

/** Hono middleware that lets a request through only with `scope`. */
export function requireScope(access: MCPAccess, scope: MCPAccessScope): MiddlewareHandler {
  return async (c, next) => access.refuse(c.req.header('authorization'), scope) ?? next()
}

export function bearerToken(header: string | undefined | null): string | null {
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
}

/** The `Authorization` value of an MCP request, which may carry its token in `x-mcp-token` instead. */
export function mcpAuthorization(
  authorization: string | undefined | null,
  headerToken: string | undefined | null
): string | null {
  if (bearerToken(authorization) !== null || !headerToken) return authorization ?? null
  return `Bearer ${headerToken}`
}

function tokensMatch(provided: string, expected: string): boolean {
  const providedDigest = createHash('sha256').update(provided, 'utf8').digest()
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(providedDigest, expectedDigest)
}
