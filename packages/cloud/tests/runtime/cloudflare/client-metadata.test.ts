import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import dns from 'node:dns/promises'

import { fetchClientMetadataOnCloudflare } from '#cloud/runtime/cloudflare/client-metadata'

import { asDouble } from '@open-pencil/test-support/doubles'

const realFetch = globalThis.fetch
const document = 'https://agent.example.com/client.json'

/** A lookup of a family the host has no records of, as `node:dns` fails it. */
function noRecords(): never {
  throw Object.assign(new Error('queryA ENODATA'), { code: 'ENODATA' })
}

/** Answers lookups with `addresses` and records what else the transport fetched, and how. */
function resolveTo(addresses: { A?: string[]; AAAA?: string[] }) {
  const fetched: { url: string; redirect?: RequestRedirect }[] = []
  spyOn(dns, 'resolve4').mockImplementation(
    asDouble<typeof dns.resolve4>(async () => addresses.A ?? noRecords())
  )
  spyOn(dns, 'resolve6').mockImplementation(
    asDouble<typeof dns.resolve6>(async () => addresses.AAAA ?? noRecords())
  )
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input)
      fetched.push({ url: url.href, redirect: init?.redirect })
      return new Response('{}', { status: 200 })
    },
    { preconnect: realFetch.preconnect }
  )
  return fetched
}

afterEach(() => {
  globalThis.fetch = realFetch
  mock.restore()
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

  test('checks the addresses a CNAME leads to, not the names it passes', async () => {
    const fetched = resolveTo({
      A: ['agent.example.net.', '10.0.0.5'],
      AAAA: ['agent.example.net.']
    })
    await expect(fetchClientMetadataOnCloudflare(document)).rejects.toThrow('public addresses')
    expect(fetched).toEqual([])
  })

  test('refuses a host that does not resolve, or only to names', async () => {
    resolveTo({ AAAA: ['agent.example.net.'] })
    await expect(fetchClientMetadataOnCloudflare(document)).rejects.toThrow('public addresses')
    const fetched = resolveTo({})
    await expect(fetchClientMetadataOnCloudflare(document)).rejects.toThrow('public addresses')
    expect(fetched).toEqual([])
  })
})
