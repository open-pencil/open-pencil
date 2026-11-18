import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { CLOUD_BILLING_API_PATHS, CLOUD_BILLING_TOKEN_AUDIENCE } from '#cloud/contract'
import { loadServicesSigningKey, parseCloudServerConfig } from '#cloud/server'
import { createBillingTokenService, createSeatNotifier } from '#cloud/server/billing'
import { decodeJwt, exportPKCS8, generateKeyPair } from 'jose'

describe('seat notices to billing', () => {
  test('post a billing token for each account, and fail on a refusal', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const accountId = crypto.randomUUID()
      await runtime.database
        .insertInto('user')
        .values({ id: accountId, name: 'Owner', email: 'owner@example.com', emailVerified: true })
        .execute()
      const { privateKey } = await generateKeyPair('ES256', { extractable: true })
      const config = parseCloudServerConfig({
        deployment: 'self-hosted',
        publicURL: 'http://localhost:8787',
        databaseURL: 'postgresql://test:test@localhost/test',
        authSecret: 'integration-test-secret-at-least-32-characters',
        s3Endpoint: 'http://localhost:9000',
        s3Region: 'us-east-1',
        s3Bucket: 'openpencil',
        s3AccessKeyId: 'openpencil',
        s3SecretAccessKey: 'openpencil-secret',
        servicesEndpoint: 'https://services.example.com',
        servicesSigningKey: await exportPKCS8(privateKey)
      })
      const signingKey = await loadServicesSigningKey(config)
      if (!signingKey) throw new Error('The test config has a signing key')
      const tokens = createBillingTokenService({
        issuer: 'http://localhost:8787',
        signingKey,
        lifetimeSeconds: 300
      })
      const sent: { url: string; token: string }[] = []
      let status = 202
      const notifier = createSeatNotifier({
        database: runtime.database,
        endpoint: 'https://billing.example.com',
        tokens,
        fetch: async (url, init) => {
          const authorization = new Headers(init.headers).get('Authorization') ?? ''
          sent.push({ url, token: authorization.replace('Bearer ', '') })
          return new Response(null, { status })
        }
      })

      await notifier.notify([accountId])
      expect(sent.map(({ url }) => url)).toEqual([
        `https://billing.example.com${CLOUD_BILLING_API_PATHS.seats}`
      ])
      expect(decodeJwt(sent[0]?.token ?? '')).toMatchObject({
        sub: accountId,
        aud: CLOUD_BILLING_TOKEN_AUDIENCE,
        email: 'owner@example.com'
      })

      status = 503
      await expect(notifier.notify([accountId])).rejects.toThrow('503')
    } finally {
      await runtime.close()
    }
  })
})
