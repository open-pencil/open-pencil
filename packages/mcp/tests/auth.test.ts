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

  test('extracts bearer and fallback MCP tokens', () => {
    expect(bearerToken('Bearer secret-token')).toBe('secret-token')
    expect(bearerToken('Basic secret-token')).toBeNull()
    expect(mcpAuthorization('Bearer bearer-token', 'header-token')).toBe('Bearer bearer-token')
    expect(mcpAuthorization(undefined, 'header-token')).toBe('Bearer header-token')
  })
})
