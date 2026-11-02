import { describe, expect, test } from 'bun:test'

import { unusedAuthAdapter } from '#cloud-tests/helpers/auth'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  aiTokenClaimsSchema,
  aiTokenSchema,
  CLOUD_AI_JWKS_PATH,
  CLOUD_AI_TOKEN_AUDIENCE
} from '#cloud/contract'
import {
  CLOUD_FEATURE_KEYS,
  CloudConfigError,
  createCloudApp,
  loadAISigningKey,
  parseCloudServerConfig,
  StaticEntitlementSource,
  type CloudActor
} from '#cloud/server'
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
  s3SecretAccessKey: 'openpencil-secret'
}

const member: CloudActor = { userId: 'member', email: 'member@example.com', name: 'Member' }
const stranger: CloudActor = { userId: 'stranger', email: 'stranger@example.com', name: 'S' }

const jwksSchema = v.custom<JSONWebKeySet>(
  (value) => v.is(v.object({ keys: v.array(v.object({ kid: v.string() })) }), value),
  'Expected a JWKS'
)

async function signingKeyPEM() {
  const { privateKey } = await generateKeyPair('ES256', { extractable: true })
  return exportPKCS8(privateKey)
}

async function testApp(options: {
  actor: CloudActor
  entitlements?: Record<string, boolean | number>
  ai?: boolean
}) {
  const runtime = await createCloudTestDatabase()
  const config = parseCloudServerConfig(
    options.ai === false
      ? baseConfig
      : { ...baseConfig, aiEndpoint: 'https://ai.example.com', aiSigningKey: await signingKeyPEM() }
  )
  const workspaceId = crypto.randomUUID()
  await runtime.database
    .insertInto('workspace')
    .values({ id: workspaceId, name: 'W', slug: `w-${workspaceId}`, createdBy: member.userId })
    .execute()
  await runtime.database
    .insertInto('workspaceMember')
    .values({ workspaceId, userId: member.userId, role: 'editor' })
    .execute()
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: unusedAuthAdapter(config),
    objects: createMemoryObjectStore().store,
    resolveSession: async () => options.actor,
    entitlementSource: new StaticEntitlementSource(options.entitlements ?? {}),
    aiSigningKey: await loadAISigningKey(config)
  })
  const requestToken = () =>
    app.request('/api/ai/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId })
    })
  return { runtime, app, workspaceId, requestToken }
}

describe('AI service tokens', () => {
  test('a member of an entitled workspace gets a token the published keys verify', async () => {
    const context = await testApp({
      actor: member,
      entitlements: {
        [CLOUD_FEATURE_KEYS.cloudAI]: true,
        [CLOUD_FEATURE_KEYS.monthlyCreditAllowance]: 5000
      }
    })
    try {
      const response = await context.requestToken()
      expect(response.status).toBe(200)
      const { token, expiresAt } = await responseJSON(response, aiTokenSchema)

      const keys = await responseJSON(await context.app.request(CLOUD_AI_JWKS_PATH), jwksSchema)
      const { payload, protectedHeader } = await jwtVerify(token, createLocalJWKSet(keys), {
        issuer: 'http://localhost:8787',
        audience: CLOUD_AI_TOKEN_AUDIENCE
      })
      expect(protectedHeader.kid).toBe(keys.keys[0]?.kid)
      expect(v.parse(aiTokenClaimsSchema, payload)).toMatchObject({
        sub: member.userId,
        workspaceId: context.workspaceId,
        monthlyCreditAllowance: 5000
      })
      expect(new Date(expiresAt).getTime()).toBe((payload.exp ?? 0) * 1000)
    } finally {
      await context.runtime.close()
    }
  })

  test('a workspace without the entitlement is refused, and one with no allowance gets null', async () => {
    const refused = await testApp({ actor: member })
    try {
      expect((await refused.requestToken()).status).toBe(403)
    } finally {
      await refused.runtime.close()
    }
    const unlimited = await testApp({
      actor: member,
      entitlements: { [CLOUD_FEATURE_KEYS.cloudAI]: true }
    })
    try {
      const { token } = await responseJSON(await unlimited.requestToken(), aiTokenSchema)
      const keys = await responseJSON(await unlimited.app.request(CLOUD_AI_JWKS_PATH), jwksSchema)
      const { payload } = await jwtVerify(token, createLocalJWKSet(keys))
      expect(payload.monthlyCreditAllowance).toBeNull()
    } finally {
      await unlimited.runtime.close()
    }
  })

  test('someone outside the workspace cannot tell it exists', async () => {
    const context = await testApp({
      actor: stranger,
      entitlements: { [CLOUD_FEATURE_KEYS.cloudAI]: true }
    })
    try {
      expect((await context.requestToken()).status).toBe(404)
    } finally {
      await context.runtime.close()
    }
  })

  test('a deployment without an AI service publishes no keys and signs no tokens', async () => {
    const context = await testApp({
      actor: member,
      ai: false,
      entitlements: { [CLOUD_FEATURE_KEYS.cloudAI]: true }
    })
    try {
      expect((await context.app.request(CLOUD_AI_JWKS_PATH)).status).toBe(404)
      expect((await context.requestToken()).status).toBe(404)
    } finally {
      await context.runtime.close()
    }
  })

  test('an app configured with a key it was not given refuses to start', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const config = parseCloudServerConfig({
        ...baseConfig,
        aiEndpoint: 'https://ai.example.com',
        aiSigningKey: await signingKeyPEM()
      })
      expect(() =>
        createCloudApp({
          config,
          database: runtime.database,
          auth: unusedAuthAdapter(config),
          objects: createMemoryObjectStore().store
        })
      ).toThrow(CloudConfigError)
    } finally {
      await runtime.close()
    }
  })
})
