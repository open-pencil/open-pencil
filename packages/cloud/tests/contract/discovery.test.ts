import { describe, expect, test } from 'bun:test'

import {
  CLOUD_DISCOVERY_PATH,
  CLOUD_PROTOCOL_VERSION,
  parseCloudDiscovery
} from '@open-pencil/cloud/contract'

const discovery = {
  protocolVersion: CLOUD_PROTOCOL_VERSION,
  deployment: 'self-hosted' as const,
  apiURL: 'https://pencil.example.com/api',
  authURL: 'https://pencil.example.com/api/auth',
  appURL: 'https://app.example.com',
  authentication: {
    socialProviders: ['google' as const],
    enterpriseSSO: true,
    enrollmentMode: 'open' as const,
    emailPassword: {
      signIn: true,
      signUp: false,
      minimumPasswordLength: 15,
      captcha: {
        provider: 'cloudflare-turnstile' as const,
        siteKey: 'public-site-key'
      }
    },
    mfa: {
      deploymentAdminRequired: true,
      totp: true,
      passkeys: true,
      recoveryCodes: true
    }
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
