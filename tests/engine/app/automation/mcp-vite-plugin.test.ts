import { describe, expect, test } from 'bun:test'
import { Readable } from 'node:stream'

import {
  DevMCPConfigurationSyntaxError,
  DevMCPConfigurationTooLargeError,
  configurationsMatch,
  createAutomationEnvironment,
  devMCPConfigurationErrorStatus,
  readDevMCPConfiguration,
  waitForAutomationHealth
} from '@/app/automation/bridge/vite-plugin'
import { parseDevMCPConfiguration } from '@/app/automation/mcp/dev-control'

describe('MCP Vite development server', () => {
  test('passes an explicit empty auth token when authentication is disabled', () => {
    const env = createAutomationEnvironment({
      authToken: 'development-token',
      baseEnv: { OPENPENCIL_MCP_AUTH_TOKEN: 'inherited-token' },
      configuration: {
        authenticationEnabled: false,
        rootDirectory: '/designs',
        disabledTools: ['eval', 'delete_node']
      },
      corsOrigin: 'http://localhost:1420',
      discoveryPath: '/tmp/mcp.json',
      httpPort: 7600,
      socketPath: '/tmp/open-pencil.sock'
    })

    expect(env.OPENPENCIL_MCP_AUTH_TOKEN).toBe('')
    expect(env.OPENPENCIL_MCP_ROOT).toBe('/designs')
    expect(env.OPENPENCIL_MCP_DISABLED_TOOLS).toBe('eval,delete_node')
    expect(env.OPENPENCIL_MCP_DISCOVERY_PATH).toBe('/tmp/mcp.json')
  })

  test('normalizes and validates typed disabled tool configuration', () => {
    expect(
      parseDevMCPConfiguration({
        authenticationEnabled: true,
        rootDirectory: '/designs',
        disabledTools: [' eval ', 'delete_node', 'eval']
      })
    ).toEqual({
      authenticationEnabled: true,
      rootDirectory: '/designs',
      disabledTools: ['eval', 'delete_node']
    })
    expect(
      parseDevMCPConfiguration({
        authenticationEnabled: true,
        rootDirectory: '',
        disabledTools: ['invalid tool']
      })
    ).toBeNull()
  })

  test('decodes UTF-8 configuration split across request chunks', async () => {
    const body = Buffer.from(
      JSON.stringify({
        authenticationEnabled: true,
        rootDirectory: '/设计',
        disabledTools: []
      })
    )
    const split = body.indexOf(Buffer.from('设')) + 1
    const request = Readable.from([body.subarray(0, split), body.subarray(split)])

    await expect(readDevMCPConfiguration(request as never)).resolves.toEqual({
      authenticationEnabled: true,
      rootDirectory: '/设计',
      disabledTools: []
    })
  })

  test('does not restart MCP for unchanged configuration', () => {
    const configuration = {
      authenticationEnabled: true,
      rootDirectory: '/designs',
      disabledTools: ['eval', 'delete_node']
    }
    expect(configurationsMatch(configuration, structuredClone(configuration))).toBe(true)
    expect(
      configurationsMatch(configuration, { ...configuration, disabledTools: ['delete_node'] })
    ).toBe(false)
  })

  test('waits through transient Portless responses until MCP is healthy', async () => {
    const statuses = [404, 404, 200]
    const requests: string[] = []
    await waitForAutomationHealth('wss://feature.mcp.open-pencil.localhost', async (input) => {
      requests.push(String(input))
      return new Response(null, { status: statuses.shift() ?? 500 })
    })

    expect(requests).toEqual([
      'https://feature.mcp.open-pencil.localhost/health',
      'https://feature.mcp.open-pencil.localhost/health',
      'https://feature.mcp.open-pencil.localhost/health'
    ])
  })

  test('classifies malformed and oversized configuration requests', async () => {
    const malformed = Readable.from(['{'])
    const malformedError = await readDevMCPConfiguration(malformed as never).catch(
      (error: unknown) => error
    )
    expect(malformedError).toBeInstanceOf(DevMCPConfigurationSyntaxError)
    expect(devMCPConfigurationErrorStatus(malformedError)).toBe(400)

    const oversized = Readable.from([Buffer.alloc(70_001)])
    const oversizedError = await readDevMCPConfiguration(oversized as never).catch(
      (error: unknown) => error
    )
    expect(oversizedError).toBeInstanceOf(DevMCPConfigurationTooLargeError)
    expect(devMCPConfigurationErrorStatus(oversizedError)).toBe(413)
    expect(devMCPConfigurationErrorStatus(new Error('restart failed'))).toBe(500)
  })
})
