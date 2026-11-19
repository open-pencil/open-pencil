import { describe, expect, test } from 'bun:test'

import { pollCloudDeviceToken, requestCloudDeviceAuthorization } from '#cloud/client'
import type { CloudDeviceAuthorization, CloudFetch } from '#cloud/client'
import type { CloudDiscovery } from '#cloud/contract'

const discovery: CloudDiscovery = {
  protocolVersion: '1',
  deployment: 'self-hosted',
  apiURL: 'https://cloud.example.com/api',
  authURL: 'https://cloud.example.com/api/auth',
  localEditor: true,
  authentication: { socialProviders: [], enterpriseSSO: false, enrollmentMode: 'open' },
  capabilities: { documents: true, workspaces: true, collaboration: true }
}

function authorization(expiresIn = 600): CloudDeviceAuthorization {
  return {
    device_code: 'device-code',
    user_code: 'ABCD-EFGH',
    verification_uri: 'https://cloud.example.com/auth/device',
    verification_uri_complete: 'https://cloud.example.com/auth/device?user_code=ABCDEFGH',
    expires_in: expiresIn,
    interval: 1
  }
}

const immediateSleep = async (): Promise<void> => undefined

describe('Cloud device authorization client', () => {
  test('requests a connection-scoped device code', async () => {
    let requestBody: unknown
    const request: CloudFetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body))
      return Response.json(authorization())
    }
    const result = await requestCloudDeviceAuthorization(discovery, 'connection-id', {
      fetch: request
    })
    expect(result.device_code).toBe('device-code')
    expect(requestBody).toMatchObject({ client_id: 'openpencil-desktop:connection-id' })
  })

  test('polls pending authorization until a bearer token is available', async () => {
    let calls = 0
    const token = await pollCloudDeviceToken(discovery, 'connection-id', authorization(), {
      sleep: immediateSleep,
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
    })
    expect(token.access_token).toBe('session-token')
    expect(calls).toBe(2)
  })

  test('maps denial without retrying', async () => {
    const error = pollCloudDeviceToken(discovery, 'connection-id', authorization(), {
      sleep: immediateSleep,
      fetch: async () =>
        Response.json(
          { error: 'access_denied', error_description: 'Authorization denied' },
          { status: 400 }
        )
    })
    await expect(error).rejects.toMatchObject({
      name: 'CloudDeviceAuthorizationError',
      code: 'denied'
    })
  })

  test('backs off after a rate limit and keeps polling', async () => {
    const waits: number[] = []
    let calls = 0
    const token = await pollCloudDeviceToken(discovery, 'connection-id', authorization(), {
      async sleep(milliseconds) {
        waits.push(milliseconds)
      },
      async fetch() {
        calls++
        return calls === 1
          ? Response.json({ message: 'Too many requests' }, { status: 429 })
          : Response.json({
              access_token: 'session-token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'openid profile'
            })
      }
    })
    expect(token.access_token).toBe('session-token')
    expect(waits).toEqual([1000, 6000])
  })

  test('reports an unreadable error response as unavailable', async () => {
    const error = pollCloudDeviceToken(discovery, 'connection-id', authorization(), {
      sleep: immediateSleep,
      fetch: async () => new Response('<html>Bad gateway</html>', { status: 502 })
    })
    await expect(error).rejects.toMatchObject({
      name: 'CloudDeviceAuthorizationError',
      code: 'unavailable'
    })
  })

  test('expires before another token request', async () => {
    let now = 0
    let requests = 0
    const error = pollCloudDeviceToken(discovery, 'connection-id', authorization(1), {
      now: () => now,
      sleep: async (milliseconds) => {
        now += milliseconds
      },
      fetch: async () => {
        requests++
        return Response.json({})
      }
    })
    await expect(error).rejects.toThrow('Cloud device authorization expired')
    expect(requests).toBe(0)
  })

  test('cancellation prevents token requests', async () => {
    const controller = new AbortController()
    let requests = 0
    const polling = pollCloudDeviceToken(discovery, 'connection-id', authorization(), {
      signal: controller.signal,
      sleep: async (_milliseconds, signal) => {
        controller.abort(new DOMException('Authorization cancelled', 'AbortError'))
        signal?.throwIfAborted()
      },
      fetch: async () => {
        requests++
        return Response.json({})
      }
    })
    await expect(polling).rejects.toHaveProperty('name', 'AbortError')
    expect(requests).toBe(0)
  })
})
