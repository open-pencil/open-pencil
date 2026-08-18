import { afterEach, describe, expect, mock, test } from 'bun:test'

import { signInToCloud, signOutFromCloud } from '@open-pencil/cloud/client'
import { parseCloudDiscovery } from '@open-pencil/cloud/contract'

const discovery = parseCloudDiscovery({
  protocolVersion: '1',
  deployment: 'self-hosted' as const,
  apiURL: 'https://cloud.example.com/api',
  authURL: 'https://cloud.example.com/api/auth',
  authentication: { socialProviders: ['google' as const], enterpriseSSO: false },
  capabilities: { documents: true, workspaces: true, collaboration: true }
})

const originalFetch = globalThis.fetch
const originalLocation = globalThis.location

afterEach(() => {
  globalThis.fetch = originalFetch
  Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation })
})

describe('Cloud Better Auth client', () => {
  test('starts social sign-in and signs out through Better Auth client actions', async () => {
    const requests: Request[] = []
    globalThis.fetch = Object.assign(
      mock(async (input, init) => {
        const request = new Request(input, init)
        requests.push(request)
        return request.url.endsWith('/sign-in/social')
          ? Response.json({ url: 'https://accounts.example.com/authorize' })
          : Response.json({ success: true })
      }),
      { preconnect: originalFetch.preconnect }
    )
    const assign = mock(() => undefined)
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { href: 'https://app.example.com/settings#cloud', assign }
    })

    await signInToCloud(discovery, 'google')
    await signOutFromCloud(discovery)

    expect(requests.map((request) => request.url)).toEqual([
      'https://cloud.example.com/api/auth/sign-in/social',
      'https://cloud.example.com/api/auth/sign-out'
    ])
    expect(assign).toHaveBeenCalledWith('https://accounts.example.com/authorize')
  })
})
