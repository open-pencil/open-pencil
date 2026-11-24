import { afterEach, describe, expect, test } from 'bun:test'

import { fetchClientMetadataOnCloudflare } from '#cloud/runtime/cloudflare/client-metadata'

const realFetch = globalThis.fetch
const document = 'https://agent.example.com/client.json'

/** Answers lookups with `addresses` and records what else the transport fetched, and how. */
function resolveTo(addresses: { A?: string[]; AAAA?: string[] }) {
  const fetched: { url: string; redirect?: RequestRedirect }[] = []
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input)
      if (url.hostname === 'cloudflare-dns.com') {
        const type = url.searchParams.get('type') === 'AAAA' ? 'AAAA' : 'A'
        const code = type === 'A' ? 1 : 28
        return Response.json({
          Status: 0,
          Answer: (addresses[type] ?? []).map((data) => ({ type: code, data }))
        })
      }
      fetched.push({ url: url.href, redirect: init?.redirect })
      return new Response('{}', { status: 200 })
    },
    { preconnect: realFetch.preconnect }
  )
  return fetched
}

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('client metadata on Cloudflare', () => {
  test('fetches a document whose host resolves to public addresses alone, without redirects', async () => {
    const fetched = resolveTo({
      A: ['93.184.215.14'],
      AAAA: ['2606:2800:21f:cb07:6820:80da:af6b:8b2c']
    })
    const response = await fetchClientMetadataOnCloudflare(document)
    expect(response.status).toBe(200)
    expect(fetched).toEqual([{ url: document, redirect: 'manual' }])
  })

  test('refuses a host with any private, loopback, or link-local address', async () => {
    for (const addresses of [
      { A: ['93.184.215.14', '10.0.0.5'] },
      { A: ['127.0.0.1'] },
      { A: ['169.254.169.254'] },
      { AAAA: ['::1'] },
      { AAAA: ['fd00::1'] }
    ]) {
      const fetched = resolveTo(addresses)
      await expect(fetchClientMetadataOnCloudflare(document)).rejects.toThrow('public addresses')
      expect(fetched).toEqual([])
    }
  })

  test('refuses a host that does not resolve', async () => {
    const fetched = resolveTo({})
    await expect(fetchClientMetadataOnCloudflare(document)).rejects.toThrow('public addresses')
    expect(fetched).toEqual([])
  })
})
