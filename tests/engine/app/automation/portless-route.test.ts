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

  test('derives a sibling MCP service for the main checkout', () => {
    expect(devAutomationRoute('https://open-pencil.localhost', 7600)).toEqual({
      browserURL: 'wss://mcp.open-pencil.localhost',
      corsOrigin: 'https://open-pencil.localhost',
      portlessServiceName: 'mcp.open-pencil',
      runtimeId: 'mcp.open-pencil.localhost'
    })
  })

  test('preserves the worktree prefix for the MCP service', () => {
    expect(devAutomationRoute('https://portless-mcp-routing.open-pencil.localhost', 7600)).toEqual({
      browserURL: 'wss://portless-mcp-routing.mcp.open-pencil.localhost',
      corsOrigin: 'https://portless-mcp-routing.open-pencil.localhost',
      portlessServiceName: 'mcp.open-pencil',
      runtimeId: 'portless-mcp-routing.mcp.open-pencil.localhost'
    })
  })

  test('rejects unrelated Portless hostnames', () => {
    expect(() => devAutomationRoute('https://other.localhost', 7600)).toThrow(
      'Unexpected OpenPencil Portless URL'
    )
  })
})
