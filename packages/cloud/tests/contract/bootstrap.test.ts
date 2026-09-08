import { describe, expect, test } from 'bun:test'

import {
  CLOUD_BOOTSTRAP_ID,
  injectCloudBootstrap,
  parseCloudBootstrap,
  serializeCloudBootstrap,
  type CloudDiscovery
} from '@open-pencil/cloud/contract'

const discovery = {
  protocolVersion: '1',
  deployment: 'self-hosted',
  apiURL: 'https://cloud.example.com/api',
  authURL: 'https://cloud.example.com/api/auth',
  appURL: 'https://app.example.com',
  authentication: {
    socialProviders: ['google'],
    enterpriseSSO: false,
    enrollmentMode: 'approval',
    emailPassword: {
      signIn: true,
      signUp: true,
      minimumPasswordLength: 15
    }
  },
  capabilities: { documents: true, workspaces: true, collaboration: true }
} satisfies CloudDiscovery

describe('Cloud web bootstrap', () => {
  test('round-trips validated discovery configuration', () => {
    expect(parseCloudBootstrap(serializeCloudBootstrap(discovery))).toEqual(discovery)
  })

  test('escapes HTML-significant and script-termination characters', () => {
    const hostile = {
      ...discovery,
      appURL: 'https://app.example.com/?value=</script>&next=>'
    }
    const serialized = serializeCloudBootstrap(hostile)
    expect(serialized).not.toContain('</script>')
    expect(serialized).not.toContain('<')
    expect(serialized).not.toContain('>')
    expect(serialized).not.toContain('&')
    expect(parseCloudBootstrap(serialized)).toEqual(hostile)
  })

  test('injects only into the explicit non-executable marker', () => {
    const marker = `<script id="${CLOUD_BOOTSTRAP_ID}" type="application/json"></script>`
    const result = injectCloudBootstrap(`<html><body>${marker}</body></html>`, discovery)
    expect(result).toContain(`id="${CLOUD_BOOTSTRAP_ID}" type="application/json">{`)
    expect(() => injectCloudBootstrap('<html></html>', discovery)).toThrow('bootstrap marker')
  })
})
