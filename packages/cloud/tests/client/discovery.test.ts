import { describe, expect, test } from 'bun:test'

import { CloudClientError, discoverCloud } from '#cloud/client'
import { CLOUD_PROTOCOL_VERSION } from '#cloud/contract'

const discovery = {
  protocolVersion: CLOUD_PROTOCOL_VERSION,
  deployment: 'official' as const,
  apiURL: 'https://cloud.openpencil.dev/api',
  authURL: 'https://cloud.openpencil.dev/api/auth',
  localEditor: true,
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

describe('discovery failures', () => {
  async function reason(
    fetch: () => Promise<Response>,
    url = 'https://cloud.example.com',
    editorVersion?: string
  ) {
    try {
      await discoverCloud(url, { fetch, editorVersion })
    } catch (error) {
      return error instanceof CloudClientError ? error.reason : 'other'
    }
    return 'none'
  }

  test('say whether the address, the network, or the server is the problem', async () => {
    expect(await reason(async () => Response.json(discovery), 'not a url')).toBe('invalid-address')
    expect(await reason(() => Promise.reject(new TypeError('fetch failed')))).toBe('unreachable')
    expect(await reason(async () => new Response(null, { status: 502 }))).toBe('unreachable')
    expect(await reason(async () => new Response(null, { status: 404 }))).toBe('not-cloud')
    expect(await reason(async () => new Response('<!doctype html>'))).toBe('not-cloud')
    expect(await reason(async () => Response.json({ name: 'something else' }))).toBe('not-cloud')
  })

  test('tell which side is behind when the server speaks another protocol version', async () => {
    expect(await reason(async () => Response.json({ ...discovery, protocolVersion: '2' }))).toBe(
      'editor-outdated'
    )
    expect(await reason(async () => Response.json({ ...discovery, protocolVersion: '0' }))).toBe(
      'server-outdated'
    )
  })

  test('refuse an editor older than the server’s minimum', async () => {
    const gated = async () => Response.json({ ...discovery, minimumEditorVersion: '0.17.0' })
    const url = 'https://cloud.example.com'
    expect(await reason(gated, url, '0.16.4')).toBe('editor-outdated')
    expect(await reason(gated, url, '0.17.0')).toBe('none')
    expect(await reason(gated, url)).toBe('none')
  })
})
