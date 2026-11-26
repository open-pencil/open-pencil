import { describe, expect, test } from 'bun:test'

import { bearerToken, createMCPAccess, mcpAuthorization } from '#mcp/auth'

describe('MCP authentication', () => {
  const access = createMCPAccess('server-token', 'client-token')

  test('gives the server token every scope and the client token MCP sessions only', () => {
    expect(access.scopes('server-token')).toEqual(['mcp', 'rpc', 'files', 'app'])
    expect(access.scopes('client-token')).toEqual(['mcp'])
    expect(access.scopes('server-token-x')).toEqual([])
    expect(access.scopes(null)).toEqual([])
  })

  test('answers a missing token with 401 and a missing scope with 403', () => {
    expect(access.refuse('Bearer server-token', 'rpc')).toBeNull()
    expect(access.refuse('Bearer client-token', 'mcp')).toBeNull()
    expect(access.refuse('Bearer client-token', 'rpc')?.status).toBe(403)
    expect(access.refuse('Bearer wrong', 'mcp')?.status).toBe(401)
    expect(access.refuse(undefined, 'mcp')?.status).toBe(401)
  })

  test('reads a token with spaces whole', () => {
    const spaced = createMCPAccess('my design token', null)
    expect(spaced.refuse('Bearer my design token', 'rpc')).toBeNull()
    expect(spaced.refuse('Bearer my', 'rpc')?.status).toBe(401)
  })

  test('opens everything when authentication is disabled', () => {
    const open = createMCPAccess(null, null)
    expect(open.scopes(null)).toContain('app')
    expect(open.refuse(undefined, 'files')).toBeNull()
  })

  test('gives an app token the app scope alone', () => {
    const withApp = createMCPAccess('server-token', 'client-token', { appToken: 'app-token' })
    expect(withApp.scopes('app-token')).toEqual(['app'])
    expect(withApp.refuse('Bearer app-token', 'app')).toBeNull()
    for (const scope of ['mcp', 'rpc', 'files'] as const) {
      expect(withApp.refuse('Bearer app-token', scope)?.status).toBe(403)
    }
    // The other tokens keep what they opened.
    expect(withApp.scopes('server-token')).toEqual(['mcp', 'rpc', 'files', 'app'])
    expect(withApp.scopes('client-token')).toEqual(['mcp'])
  })

  test('opens nothing to an app token when none is configured', () => {
    expect(access.scopes('app-token')).toEqual([])
  })

  test('lets tokenless clients into MCP sessions only', () => {
    const tokenless = createMCPAccess('server-token', 'client-token', {
      appToken: 'app-token',
      tokenlessClients: true
    })
    expect(tokenless.scopes(null)).toEqual(['mcp'])
    expect(tokenless.refuse(undefined, 'mcp')).toBeNull()
    for (const scope of ['rpc', 'files', 'app'] as const) {
      expect(tokenless.refuse(undefined, scope)?.status).toBe(403)
    }
    // A wrong token is still refused, not taken for a missing one.
    expect(tokenless.refuse('Bearer wrong', 'mcp')?.status).toBe(401)
    expect(tokenless.scopes('server-token')).toEqual(['mcp', 'rpc', 'files', 'app'])
  })

  test('extracts bearer and fallback MCP tokens', () => {
    expect(bearerToken('Bearer secret-token')).toBe('secret-token')
    expect(bearerToken('Basic secret-token')).toBeNull()
    expect(mcpAuthorization('Bearer bearer-token', 'header-token')).toBe('Bearer bearer-token')
    expect(mcpAuthorization(undefined, 'header-token')).toBe('Bearer header-token')
  })
})
