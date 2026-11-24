import { describe, expect, test } from 'bun:test'

import {
  CLOUD_DISCOVERY_PATH,
  CLOUD_PROTOCOL_VERSION,
  isEditorVersionAtLeast,
  parseCloudDiscovery
} from '#cloud/contract'

const discovery = {
  protocolVersion: CLOUD_PROTOCOL_VERSION,
  deployment: 'self-hosted' as const,
  apiURL: 'https://pencil.example.com/api',
  authURL: 'https://pencil.example.com/api/auth',
  localEditor: true,
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
    collaboration: false,
    apps: false,
    agents: false
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

  test('reads a minimum editor version, a pre-release too, and refuses one that is not SemVer', () => {
    for (const minimumEditorVersion of [
      '0.17.0',
      '0.18.0-beta.2',
      '0.18.0-nightly.20261116',
      '0.18.0+build.5'
    ]) {
      expect(parseCloudDiscovery({ ...discovery, minimumEditorVersion })).toMatchObject({
        minimumEditorVersion
      })
    }
    for (const minimumEditorVersion of ['latest', 'v0.17.0', '0.17', ' 0.17.0']) {
      expect(() => parseCloudDiscovery({ ...discovery, minimumEditorVersion })).toThrow()
    }
  })

  test('leaves out sign-in providers this editor has no button for', () => {
    const authentication = {
      ...discovery.authentication,
      socialProviders: ['gitlab', 'github', 'google']
    }
    expect(parseCloudDiscovery({ ...discovery, authentication }).authentication).toMatchObject({
      socialProviders: ['github', 'google']
    })
  })

  test('compares editor versions by number, not by text', () => {
    expect(isEditorVersionAtLeast('0.14.0', '0.14.0')).toBe(true)
    expect(isEditorVersionAtLeast('0.14.2', '0.14.0')).toBe(true)
    expect(isEditorVersionAtLeast('0.10.0', '0.9.5')).toBe(true)
    expect(isEditorVersionAtLeast('0.9.5', '0.10.0')).toBe(false)
    expect(isEditorVersionAtLeast('next', '1.0.0')).toBe(false)
    // Build metadata takes no part in the order.
    expect(isEditorVersionAtLeast('1.0.0+local.1', '1.0.0')).toBe(true)
    expect(isEditorVersionAtLeast('1.0.0', '1.0.0+ci.7')).toBe(true)
    expect(isEditorVersionAtLeast('v1.0.0', '1.0.0')).toBe(false)
  })

  test('orders pre-releases before their release, and nightlies after betas by date', () => {
    expect(isEditorVersionAtLeast('1.0.0-beta.1', '1.0.0')).toBe(false)
    expect(isEditorVersionAtLeast('1.0.0', '1.0.0-beta.1')).toBe(true)
    expect(isEditorVersionAtLeast('1.0.0-beta.10', '1.0.0-beta.9')).toBe(true)
    expect(isEditorVersionAtLeast('1.0.0-nightly.20261116', '1.0.0-beta.5')).toBe(true)
    expect(isEditorVersionAtLeast('1.0.0-beta.5', '1.0.0-nightly.20261116')).toBe(false)
    expect(isEditorVersionAtLeast('1.0.0-nightly.20261116', '1.0.0')).toBe(false)
    expect(isEditorVersionAtLeast('1.0.0-nightly.20261120', '1.0.0-nightly.20261116')).toBe(true)
    expect(isEditorVersionAtLeast('1.0.0-nightly.20261115', '1.0.0-nightly.20261116')).toBe(false)
    expect(isEditorVersionAtLeast('1.1.0-nightly.20261201', '1.0.0')).toBe(true)
  })
})
