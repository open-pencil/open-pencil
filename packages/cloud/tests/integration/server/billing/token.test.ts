import { describe, expect, test } from 'bun:test'

import { unusedAuthAdapter } from '#cloud-tests/helpers/auth'
import { contractClient, outcome } from '#cloud-tests/helpers/contract'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  billingTokenClaimsSchema,
  CLOUD_BILLING_TOKEN_AUDIENCE,
  CLOUD_SERVICES_TOKEN_AUDIENCE
} from '#cloud/contract'
import {
  createCloudApp,
  loadServicesSigningKey,
  parseCloudServerConfig,
  type CloudActor
} from '#cloud/server'
import { testClient } from 'hono/testing'
import {
  createLocalJWKSet,
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
  type JSONWebKeySet
} from 'jose'
import * as v from 'valibot'

const baseConfig = {
  deployment: 'self-hosted' as const,
  publicURL: 'http://localhost:8787',
  databaseURL: 'postgresql://test:test@localhost/test',
  authSecret: 'integration-test-secret-at-least-32-characters',
  s3Endpoint: 'http://localhost:9000',
  s3Region: 'us-east-1',
  s3Bucket: 'openpencil',
  s3AccessKeyId: 'openpencil',
  s3SecretAccessKey: 'openpencil-secret',
  servicesEndpoint: 'https://services.example.com',
  internalServiceToken: 'service-token-with-at-least-32-characters'
}

const person: CloudActor = { userId: 'person', email: 'person@example.com', name: 'Person' }

const jwksSchema = v.custom<JSONWebKeySet>(
  (value) => v.is(v.object({ keys: v.array(v.object({ kid: v.string() })) }), value),
  'Expected a JWKS'
)

async function testApp(options: { billing: boolean }) {
  const runtime = await createCloudTestDatabase()
  const { privateKey } = await generateKeyPair('ES256', { extractable: true })
  const config = parseCloudServerConfig({
    ...baseConfig,
    servicesSigningKey: await exportPKCS8(privateKey),
    ...(options.billing && { billingEndpoint: 'https://billing.example.com' })
  })
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: unusedAuthAdapter(config),
    objects: createMemoryObjectStore().store,
    resolveSession: async () => person,
    servicesSigningKey: await loadServicesSigningKey(config)
  })
  const client = testClient(app)
  const api = contractClient(app)
  const requestToken = () => api.session.billingToken()
  return { runtime, app, client, requestToken }
}

describe('Billing tokens', () => {
  test('name the signed-in account, for billing only, under the published keys', async () => {
    const context = await testApp({ billing: true })
    try {
      const { token, expiresAt } = await context.requestToken()
      const keys = createLocalJWKSet(
        await responseJSON(await context.client['.well-known']['jwks.json'].$get(), jwksSchema)
      )
      const { payload } = await jwtVerify(token, keys, {
        issuer: 'http://localhost:8787',
        audience: CLOUD_BILLING_TOKEN_AUDIENCE
      })
      expect(v.parse(billingTokenClaimsSchema, payload)).toMatchObject({
        sub: person.userId,
        email: person.email
      })
      expect(new Date(expiresAt).getTime()).toBe((payload.exp ?? 0) * 1000)
      // A billing token is no services token, so it spends no credits.
      await expect(
        jwtVerify(token, keys, { audience: CLOUD_SERVICES_TOKEN_AUDIENCE })
      ).rejects.toThrow()
    } finally {
      await context.runtime.close()
    }
  })

  test('are not found where the deployment sells nothing', async () => {
    const context = await testApp({ billing: false })
    try {
      expect(await outcome(context.requestToken())).toMatchObject({ status: 404 })
    } finally {
      await context.runtime.close()
    }
  })
})
