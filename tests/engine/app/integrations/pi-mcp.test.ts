import { describe, expect, test } from 'bun:test'

import { replaceMCPConnectionSettings, setMCPConnectionCredential } from '@/app/integrations/mcp'
import { buildPiMCPServers } from '@/app/integrations/mcp/pi'

import { installTauriMockWindow } from '#tests/helpers/tauri/mocks'

installTauriMockWindow()

describe('Pi MCP configuration', () => {
  test('adapts the built-in and external MCP servers to Pi native configuration', async () => {
    replaceMCPConnectionSettings({
      version: 1,
      connections: [
        {
          id: 'mcp-example',
          name: 'example',
          enabled: true,
          transport: { type: 'streamable-http', url: 'https://example.com/mcp' },
          authentication: {
            type: 'bearer',
            credentialRef: {
              integrationId: 'mcp',
              profileId: 'mcp-example',
              field: 'bearer-token'
            }
          }
        }
      ]
    })
    await setMCPConnectionCredential('mcp-example', 'external-token')

    const servers = await buildPiMCPServers({ authorizationToken: 'built-in-token' })
    expect(servers.example).toEqual({
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer external-token' },
      auth: false
    })
    expect(servers['open-pencil']).toEqual({
      url: expect.stringContaining('/mcp'),
      headers: { Authorization: 'Bearer built-in-token' },
      auth: false
    })
  })
})
