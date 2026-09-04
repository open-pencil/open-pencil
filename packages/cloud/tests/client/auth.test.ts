import { describe, expect, mock, test } from 'bun:test'

import {
  createCloudAuthClient,
  signInToCloud,
  signOutFromCloud,
  type CloudFetch
} from '@open-pencil/cloud/client'
import { parseCloudDiscovery } from '@open-pencil/cloud/contract'

const discovery = parseCloudDiscovery({
  protocolVersion: '1',
  deployment: 'self-hosted' as const,
  apiURL: 'https://cloud.example.com/api',
  authURL: 'https://cloud.example.com/api/auth',
  appURL: 'https://app.example.com',
  authentication: { socialProviders: ['google' as const], enterpriseSSO: false },
  capabilities: { documents: true, workspaces: true, collaboration: true }
})

describe('Cloud Better Auth client', () => {
  test('sends the CAPTCHA response through Better Auth', async () => {
    let request: Request | undefined
    const fetch: CloudFetch = mock(async (input, init) => {
      request = new Request(input, init)
      return Response.json({ status: true })
    })
    const client = createCloudAuthClient(discovery, {
      captchaResponse: 'turnstile-token',
      fetch
    })

    await client.requestPasswordReset({
      email: 'person@example.com',
      redirectTo: 'https://cloud.example.com/auth/reset-password'
    })

    expect(request?.headers.get('x-captcha-response')).toBe('turnstile-token')
  })

  test('starts social sign-in and signs out through Better Auth client actions', async () => {
    const requests: Request[] = []
    const fetch: CloudFetch = mock(async (input, init) => {
      const request = new Request(input, init)
      requests.push(request)
      return request.url.endsWith('/sign-in/social')
        ? Response.json({ url: 'https://accounts.example.com/authorize' })
        : Response.json({ success: true })
    })
    const navigate = mock(() => undefined)

    await signInToCloud(discovery, 'google', {
      callbackURL: 'https://app.example.com/settings',
      fetch,
      navigate
    })
    await signOutFromCloud(discovery, { fetch })

    expect(requests.map((request) => request.url)).toEqual([
      'https://cloud.example.com/api/auth/sign-in/social',
      'https://cloud.example.com/api/auth/sign-out'
    ])
    expect(navigate).toHaveBeenCalledWith('https://accounts.example.com/authorize')
  })
})
