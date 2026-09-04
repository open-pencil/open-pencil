import { describe, expect, test } from 'bun:test'

import { CloudClientError, discoverCloud } from '@open-pencil/cloud/client'
import { CLOUD_PROTOCOL_VERSION } from '@open-pencil/cloud/contract'

const discovery = {
  protocolVersion: CLOUD_PROTOCOL_VERSION,
  deployment: 'official' as const,
  apiURL: 'https://cloud.openpencil.dev/api',
  authURL: 'https://cloud.openpencil.dev/api/auth',
  appURL: 'https://app.openpencil.dev',
  authentication: {
    socialProviders: ['apple' as const, 'google' as const],
    enterpriseSSO: false,
    enrollmentMode: 'open' as const,
    emailPassword: {
      signIn: true,
      signUp: true,
      minimumPasswordLength: 15,
      captcha: {
        provider: 'cloudflare-turnstile' as const,
        siteKey: 'public-site-key'
      }
    }
  },
  capabilities: {
    documents: true,
    workspaces: true,
    collaboration: false
  }
}

describe('discoverCloud', () => {
  test('loads and validates discovery from the well-known path', async () => {
    let requestedURL = ''
    const result = await discoverCloud('https://cloud.openpencil.dev/custom?ignored=yes', {
      fetch: async (input) => {
        requestedURL = String(input)
        return Response.json(discovery)
      }
    })

    expect(requestedURL).toBe('https://cloud.openpencil.dev/.well-known/openpencil')
    expect(result).toEqual(discovery)
  })

  test('reports non-successful discovery responses', async () => {
    const request = discoverCloud('https://cloud.openpencil.dev', {
      fetch: async () => new Response(null, { status: 404 })
    })

    await expect(request).rejects.toThrow('HTTP 404')
  })

  test('rejects non-HTTP server URLs before fetching', async () => {
    const request = discoverCloud('file:///tmp/openpencil', {
      fetch: async () => Response.json(discovery)
    })

    await expect(request).rejects.toBeInstanceOf(CloudClientError)
  })
})
