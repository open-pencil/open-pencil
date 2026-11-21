import { describe, expect, test } from 'bun:test'

import { CLOUD_BILLING_TOKEN_PATH } from '#cloud/contract'
import { createCloudCORS } from '#cloud/server/app/cors'
import { Hono } from 'hono'

const CLOUD = 'https://cloud.example'
const BILLING = 'https://billing.example'

const app = new Hono()
  .use('/api/*', createCloudCORS(new Set([CLOUD]), BILLING))
  .post(CLOUD_BILLING_TOKEN_PATH, (context) => context.json({ token: 'signed' }))
  .get('/api/session', (context) => context.json({ user: null }))

function preflight(path: string, origin: string, method = 'POST') {
  return app.request(path, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': method }
  })
}

describe('Cloud CORS', () => {
  test("lets billing's pages ask for a billing token with the visitor's session", async () => {
    const asked = await preflight(CLOUD_BILLING_TOKEN_PATH, BILLING)
    expect(asked.headers.get('Access-Control-Allow-Origin')).toBe(BILLING)
    expect(asked.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    const answered = await app.request(CLOUD_BILLING_TOKEN_PATH, {
      method: 'POST',
      headers: { Origin: BILLING }
    })
    expect(answered.headers.get('Access-Control-Allow-Origin')).toBe(BILLING)
  })

  test('gives billing nothing else, and nobody else a billing token', async () => {
    const session = await app.request('/api/session', { headers: { Origin: BILLING } })
    expect(session.headers.get('Access-Control-Allow-Origin')).toBeNull()
    const other = await preflight(CLOUD_BILLING_TOKEN_PATH, 'https://elsewhere.example')
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  test('without a billing service, billing is no different from any other page', async () => {
    const plain = new Hono()
      .use('/api/*', createCloudCORS(new Set([CLOUD])))
      .post(CLOUD_BILLING_TOKEN_PATH, (context) => context.json({ token: 'signed' }))
    const asked = await plain.request(CLOUD_BILLING_TOKEN_PATH, {
      method: 'OPTIONS',
      headers: { Origin: BILLING, 'Access-Control-Request-Method': 'POST' }
    })
    expect(asked.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})
