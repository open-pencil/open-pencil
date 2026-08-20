import { describe, expect, test } from 'bun:test'

import { createAutomationEnvironment } from '@/app/automation/bridge/vite-plugin'

describe('MCP Vite development server', () => {
  test('passes an explicit empty auth token when authentication is disabled', () => {
    const env = createAutomationEnvironment({
      authToken: 'development-token',
      baseEnv: { OPENPENCIL_MCP_AUTH_TOKEN: 'inherited-token' },
      configuration: {
        authenticationEnabled: false,
        rootDirectory: '/designs',
        disabledTools: 'eval,delete_node'
      },
      corsOrigin: 'http://localhost:1420',
      socketPath: '/tmp/open-pencil.sock'
    })

    expect(env.OPENPENCIL_MCP_AUTH_TOKEN).toBe('')
    expect(env.OPENPENCIL_MCP_ROOT).toBe('/designs')
    expect(env.OPENPENCIL_MCP_DISABLED_TOOLS).toBe('eval,delete_node')
  })
})
