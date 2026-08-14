import { describe, expect, test } from 'bun:test'

import { CLOUD_DISCOVERY_PATH, CLOUD_PROTOCOL_VERSION } from '../src/contract'
import { createCloudApp } from '../src/server'

const config = {
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

describe('createCloudApp', () => {
  test('serves a health response without starting a listener', async () => {
    const response = await createCloudApp(config).request('/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'ok',
      protocolVersion: CLOUD_PROTOCOL_VERSION
    })
  })

  test('serves validated deployment discovery', async () => {
    const response = await createCloudApp(config).request(CLOUD_DISCOVERY_PATH)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ...config,
      protocolVersion: CLOUD_PROTOCOL_VERSION
    })
  })

  test('rejects invalid configuration while creating the app', () => {
    expect(() => createCloudApp({ ...config, apiURL: '/api' })).toThrow()
  })
})
