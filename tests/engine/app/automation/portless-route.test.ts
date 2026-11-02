import { describe, expect, test } from 'bun:test'

import { devAutomationRoute } from '@/app/automation/bridge/portless-route'

describe('Portless MCP routing', () => {
  test('uses the fixed localhost bridge outside Portless', () => {
    expect(devAutomationRoute(undefined, 7600)).toEqual({
      browserURL: 'ws://127.0.0.1:7600',
      corsOrigin: 'http://localhost:1420',
      portlessServiceName: null,
      runtimeId: 'localhost-7600'
    })
  })

  test('uses the requested app origin and an isolated fixed-port runtime', () => {
    expect(devAutomationRoute(undefined, 7682, 'http://localhost:1482')).toEqual({
      browserURL: 'ws://127.0.0.1:7682',
      corsOrigin: 'http://localhost:1482',
      portlessServiceName: null,
      runtimeId: 'localhost-7682'
    })
  })

  test('derives a sibling MCP service for the main checkout', () => {
    expect(devAutomationRoute('https://lawha.localhost', 7600)).toEqual({
      browserURL: 'wss://mcp.lawha.localhost',
      corsOrigin: 'https://lawha.localhost',
      portlessServiceName: 'mcp.lawha',
      runtimeId: 'mcp.lawha.localhost'
    })
  })

  test('preserves the worktree prefix for the MCP service', () => {
    expect(devAutomationRoute('https://portless-mcp-routing.lawha.localhost', 7600)).toEqual({
      browserURL: 'wss://portless-mcp-routing.mcp.lawha.localhost',
      corsOrigin: 'https://portless-mcp-routing.lawha.localhost',
      portlessServiceName: 'mcp.lawha',
      runtimeId: 'portless-mcp-routing.mcp.lawha.localhost'
    })
  })

  test('preserves a nonstandard HTTPS proxy port', () => {
    const route = devAutomationRoute('https://chat-history.lawha.localhost:1355', 7600)
    expect(route.browserURL).toBe('wss://chat-history.mcp.lawha.localhost:1355')
    expect(route.corsOrigin).toBe('https://chat-history.lawha.localhost:1355')
  })

  test('rejects unrelated Portless hostnames', () => {
    expect(() => devAutomationRoute('https://other.localhost', 7600)).toThrow(
      'Unexpected Lawha Portless URL'
    )
  })
})
