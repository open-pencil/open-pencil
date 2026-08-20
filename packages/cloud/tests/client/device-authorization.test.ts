import { describe, expect, test } from 'bun:test'

import { pollCloudDeviceToken, requestCloudDeviceAuthorization } from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

const discovery: CloudDiscovery = {
  protocolVersion: '1',
  deployment: 'self-hosted',
  apiURL: 'https://cloud.example.com/api',
  authURL: 'https://cloud.example.com/api/auth',
  authentication: { socialProviders: [], enterpriseSSO: false },
  capabilities: { documents: true, workspaces: true, collaboration: true }
}

describe('Cloud device authorization client', () => {
  test('requests a connection-scoped device code', async () => {
    const originalFetch = globalThis.fetch
    let requestBody: unknown
    globalThis.fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body))
      return Response.json({
        device_code: 'device-code',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://cloud.example.com/cloud/device',
        verification_uri_complete: 'https://cloud.example.com/cloud/device?user_code=ABCDEFGH',
        expires_in: 600,
        interval: 1
      })
    }
    try {
      const result = await requestCloudDeviceAuthorization(discovery, 'connection-id')
      expect(result.device_code).toBe('device-code')
      expect(requestBody).toMatchObject({ client_id: 'openpencil-desktop:connection-id' })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('polls pending authorization until a bearer token is available', async () => {
    let calls = 0
    const token = await pollCloudDeviceToken(
      discovery,
      'connection-id',
      {
        device_code: 'device-code',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://cloud.example.com/cloud/device',
        verification_uri_complete: 'https://cloud.example.com/cloud/device?user_code=ABCDEFGH',
        expires_in: 600,
        interval: 1
      },
      {
        async fetch() {
          calls++
          return calls === 1
            ? Response.json(
                { error: 'authorization_pending', error_description: 'Pending' },
                { status: 400 }
              )
            : Response.json({
                access_token: 'session-token',
                token_type: 'Bearer',
                expires_in: 3600,
                scope: 'openid profile'
              })
        }
      }
    )
    expect(token.access_token).toBe('session-token')
    expect(calls).toBe(2)
  }, 5000)
})
