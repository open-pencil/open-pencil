import { describe, expect, test } from 'bun:test'

import { bearerToken, isAuthorized, mcpRequestToken } from '#mcp/auth'

describe('MCP authentication', () => {
  test('accepts exact tokens and rejects mismatches', () => {
    expect(isAuthorized('secret-token', 'secret-token')).toBe(true)
    expect(isAuthorized('secret-token-x', 'secret-token')).toBe(false)
    expect(isAuthorized(null, 'secret-token')).toBe(false)
  })

  test('allows requests when authentication is disabled', () => {
    expect(isAuthorized(null, null)).toBe(true)
    expect(isAuthorized('unused', null)).toBe(true)
  })

  test('extracts bearer and fallback MCP tokens', () => {
    expect(bearerToken('Bearer secret-token')).toBe('secret-token')
    expect(bearerToken('Basic secret-token')).toBeNull()
    expect(mcpRequestToken('Bearer bearer-token', 'header-token')).toBe('bearer-token')
    expect(mcpRequestToken(undefined, 'header-token')).toBe('header-token')
  })
})
