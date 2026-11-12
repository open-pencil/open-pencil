import { describe, expect, test } from 'bun:test'

import {
  CloudBillingError,
  CloudServiceInsecureEndpointError,
  createCloudAPIClient,
  createCloudBillingClient
} from '#cloud/client'
import { CLOUD_BILLING_API_PATHS } from '#cloud/contract'

const invalidated: string[] = []
const tokens = {
  async token() {
    return 'billing-token'
  },
  invalidate(token: string) {
    invalidated.push(token)
  }
}

function billing(answer: (request: Request) => Response) {
  const requests: Request[] = []
  const client = createCloudBillingClient({
    endpoint: 'https://billing.example.com/',
    tokens,
    fetch: async (input, init) => {
      const request = new Request(input, init)
      requests.push(request)
      return answer(request)
    }
  })
  return { client, requests }
}

describe('Cloud billing client', () => {
  test('signs a token for the signed-in account through the typed Cloud API', async () => {
    const requests: Request[] = []
    const cloud = createCloudAPIClient('https://cloud.example.com/api', {
      fetch: async (input, init) => {
        requests.push(new Request(input, init))
        return Response.json({ token: 'signed', expiresAt: '2026-10-21T12:10:00.000Z' })
      }
    })
    expect(await cloud.requestBillingToken()).toEqual({
      token: 'signed',
      expiresAt: '2026-10-21T12:10:00.000Z'
    })
    expect(requests[0]?.url).toBe('https://cloud.example.com/api/billing/token')
    expect(requests[0]?.method).toBe('POST')
  })

  test('asks for checkout with the token in a header, and answers with the page to open', async () => {
    const { client, requests } = billing(() =>
      Response.json({ url: 'https://checkout.stripe.com/c/pay/session' })
    )
    expect(await client.checkout({ planId: 'pro' })).toBe(
      'https://checkout.stripe.com/c/pay/session'
    )
    const [request] = requests
    expect(request?.url).toBe(`https://billing.example.com${CLOUD_BILLING_API_PATHS.checkout}`)
    expect(request?.headers.get('Authorization')).toBe('Bearer billing-token')
    expect(await request?.json()).toEqual({ planId: 'pro' })
  })

  test("raises billing's error code, and refuses an answer it does not recognise", async () => {
    const refusing = billing(() =>
      Response.json({ error: { code: 'not_allowed' } }, { status: 409 })
    ).client
    const error = await refusing.checkout({ creditPackId: 'credits-5k' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CloudBillingError)
    expect(error).toMatchObject({ status: 409, code: 'not_allowed' })

    // A refusal whose body cannot be read still says how it was refused.
    const unreadable = billing(
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error('connection reset'))
            }
          }),
          { status: 502 }
        )
    ).client
    const cut = await unreadable.portal().catch((e: unknown) => e)
    expect(cut).toBeInstanceOf(CloudBillingError)
    expect(cut).toMatchObject({ status: 502, code: undefined })

    const garbled = billing(() => Response.json({ url: 'not a URL' })).client
    await expect(garbled.portal()).rejects.toThrow()
    // Only an HTTPS page is opened, never a scheme a browser would run.
    // A script URL, built so the test carries no runnable literal, and a plain HTTP page.
    for (const url of [
      ['javascript', 'alert(1)'].join(':'),
      'http://checkout.example.com/session'
    ]) {
      await expect(billing(() => Response.json({ url })).client.portal()).rejects.toThrow()
    }
  })

  test('sends a token only over HTTPS, or in the clear only to this machine', async () => {
    for (const endpoint of ['http://billing.example.com', 'http://10.0.0.5:8787']) {
      let signed = 0
      let sent = 0
      const client = createCloudBillingClient({
        endpoint,
        tokens: {
          async token() {
            signed++
            return 'billing-token'
          },
          invalidate: tokens.invalidate
        },
        fetch: async () => {
          sent++
          return Response.json({ url: 'https://billing.stripe.com/session' })
        }
      })
      await expect(client.portal()).rejects.toBeInstanceOf(CloudServiceInsecureEndpointError)
      expect({ signed, sent }).toEqual({ signed: 0, sent: 0 })
    }
    for (const endpoint of ['http://localhost:8787', 'http://127.0.0.1:8787']) {
      const client = createCloudBillingClient({
        endpoint,
        tokens,
        fetch: async () => Response.json({ url: 'https://billing.stripe.com/session' })
      })
      expect(await client.portal()).toBe('https://billing.stripe.com/session')
    }
  })
})
