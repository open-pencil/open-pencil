import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import {
  buildACPMCPServers,
  createMCPConnectionDraft,
  mcpConnectionSettingsSnapshot,
  parseMCPConnectionSettings,
  removeMCPConnection,
  replaceMCPConnectionSettings,
  saveMCPConnectionDraft,
  setMCPConnectionCredential,
  validateMCPConnectionURL,
  type MCPConnectionSettings
} from '@/app/integrations/mcp'
import { appCredentialServices } from '@/app/settings/credentials/app'

import { captureACPSessionMCPServers } from '#tests/helpers/mcp/acp-session'

let original: MCPConnectionSettings

beforeEach(() => {
  original = mcpConnectionSettingsSnapshot()
  replaceMCPConnectionSettings({ version: 1, connections: [] })
})

afterEach(() => {
  vi.restoreAllMocks()
  replaceMCPConnectionSettings(original)
})

describe('MCP connections', () => {
  test('accepts HTTPS and loopback HTTP endpoints only', () => {
    expect(validateMCPConnectionURL('https://example.com/mcp').hostname).toBe('example.com')
    expect(validateMCPConnectionURL('http://127.0.0.1:3333/mcp').port).toBe('3333')
    expect(() => validateMCPConnectionURL('http://example.com/mcp')).toThrow('HTTPS')
    expect(() => validateMCPConnectionURL('https://user:secret@example.com/mcp')).toThrow(
      'credentials'
    )
  })

  test('repairs malformed, reserved, and duplicate persisted connections', () => {
    expect(parseMCPConnectionSettings(null)).toEqual({ version: 1, connections: [] })
    expect(
      parseMCPConnectionSettings({
        version: 1,
        connections: [
          {
            id: 'mcp-valid',
            name: 'Valid',
            enabled: true,
            transport: { type: 'streamable-http', url: 'https://example.com/mcp' },
            authentication: { type: 'none' }
          },
          {
            id: 'mcp-reserved',
            name: 'Open-Pencil',
            enabled: true,
            transport: { type: 'streamable-http', url: 'https://reserved.example.com/mcp' },
            authentication: { type: 'none' }
          },
          {
            id: 'mcp-duplicate-name',
            name: 'valid',
            enabled: true,
            transport: { type: 'streamable-http', url: 'https://duplicate.example.com/mcp' },
            authentication: { type: 'none' }
          },
          {
            id: 'mcp-../../other-integration',
            name: 'Unsafe credential reference',
            enabled: true,
            transport: { type: 'streamable-http', url: 'https://example.com/mcp' },
            authentication: { type: 'bearer' }
          },
          {
            id: 'mcp-invalid',
            name: 'Invalid',
            enabled: true,
            transport: { type: 'streamable-http', url: 'file:///tmp/mcp' }
          }
        ]
      }).connections.map((connection) => connection.id)
    ).toEqual(['mcp-valid'])
  })

  test('defaults new connections to disabled and reserves unique names', async () => {
    const draft = createMCPConnectionDraft()
    expect(draft.enabled).toBeFalse()
    draft.name = 'GitHub'
    draft.url = 'https://example.com/mcp'
    const connection = saveMCPConnectionDraft(draft)
    expect(connection.enabled).toBeFalse()
    expect(await buildACPMCPServers({ authorizationToken: null })).toHaveLength(1)

    const duplicate = createMCPConnectionDraft()
    duplicate.name = 'github'
    duplicate.url = 'https://other.example.com/mcp'
    expect(() => saveMCPConnectionDraft(duplicate)).toThrow('unique')
    duplicate.name = 'open-pencil'
    expect(() => saveMCPConnectionDraft(duplicate)).toThrow('reserved')

    duplicate.id = 'mcp-../../unsafe' as typeof duplicate.id
    duplicate.name = 'Safe name'
    expect(() => saveMCPConnectionDraft(duplicate)).toThrow('ID is invalid')
  })

  test('composes enabled external servers after the built-in server', async () => {
    const draft = createMCPConnectionDraft()
    draft.name = 'GitHub'
    draft.url = 'https://example.com/mcp'
    draft.enabled = true
    draft.authenticationType = 'bearer'
    const connection = saveMCPConnectionDraft(draft)
    try {
      await setMCPConnectionCredential(connection.id, 'secret-token')
      expect(await buildACPMCPServers({ authorizationToken: 'built-in-token' })).toEqual([
        {
          type: 'http',
          name: 'open-pencil',
          url: expect.stringContaining('/mcp'),
          headers: [{ name: 'Authorization', value: 'Bearer built-in-token' }]
        },
        {
          type: 'http',
          name: 'GitHub',
          url: 'https://example.com/mcp',
          headers: [{ name: 'Authorization', value: 'Bearer secret-token' }]
        }
      ])
    } finally {
      await setMCPConnectionCredential(connection.id, '')
    }
  })

  test('keeps the connection when credential deletion fails', async () => {
    const draft = createMCPConnectionDraft()
    draft.name = 'Protected connection'
    draft.url = 'https://example.com/mcp'
    const connection = saveMCPConnectionDraft(draft)
    vi.spyOn(appCredentialServices.manager, 'clear').mockRejectedValue(
      new Error('Credential store unavailable')
    )

    await expect(removeMCPConnection(connection.id)).rejects.toThrow('unavailable')
    expect(mcpConnectionSettingsSnapshot().connections.map((item) => item.id)).toContain(
      connection.id
    )
  })

  test('delivers built-in and external server configuration over a real ACP session', async () => {
    const draft = createMCPConnectionDraft()
    draft.name = 'Smoke server'
    draft.url = 'https://smoke.example.com/mcp'
    draft.enabled = true
    saveMCPConnectionDraft(draft)

    expect(await captureACPSessionMCPServers()).toEqual([
      {
        type: 'http',
        name: 'open-pencil',
        url: expect.stringContaining('/mcp'),
        headers: [{ name: 'Authorization', value: 'Bearer built-in-token' }]
      },
      {
        type: 'http',
        name: 'Smoke server',
        url: 'https://smoke.example.com/mcp',
        headers: []
      }
    ])
  })

  test('fails clearly when an enabled authenticated connection has no token', async () => {
    const draft = createMCPConnectionDraft()
    draft.name = 'Missing token'
    draft.url = 'https://example.com/mcp'
    draft.enabled = true
    draft.authenticationType = 'bearer'
    saveMCPConnectionDraft(draft)

    await expect(buildACPMCPServers({ authorizationToken: null })).rejects.toThrow(
      'needs a bearer token'
    )
  })
})
