import { describe, expect, test } from 'bun:test'

import { CLOUD_DISCOVERY_PATH, CLOUD_PROTOCOL_VERSION, parseCloudDiscovery } from '../src/contract'

const discovery = {
  protocolVersion: CLOUD_PROTOCOL_VERSION,
  deployment: 'self-hosted' as const,
  apiURL: 'https://pencil.example.com/api',
  authURL: 'https://pencil.example.com/api/auth',
  authentication: {
    socialProviders: ['google' as const],
    enterpriseSSO: true
  },
  capabilities: {
    documents: true,
    workspaces: true,
    collaboration: false
  }
}

describe('Cloud discovery contract', () => {
  test('publishes the stable discovery path and protocol version', () => {
    expect(CLOUD_DISCOVERY_PATH).toBe('/.well-known/openpencil')
    expect(CLOUD_PROTOCOL_VERSION).toBe('1')
  })

  test('parses a valid discovery document', () => {
    expect(parseCloudDiscovery(discovery)).toEqual(discovery)
  })

  test('rejects an unsupported protocol version', () => {
    expect(() => parseCloudDiscovery({ ...discovery, protocolVersion: '2' })).toThrow()
  })

  test('rejects relative service URLs', () => {
    expect(() => parseCloudDiscovery({ ...discovery, apiURL: '/api' })).toThrow()
  })
})
