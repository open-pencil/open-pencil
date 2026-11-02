import { createHash } from 'node:crypto'

import {
  createAIRelayApp,
  createAIRelayDatabase,
  migrateAIRelayDatabase,
  parseAIRelayConfig
} from '#cloud/ai-relay'
import { CLOUD_AI_CONTRACT_VERSION, CLOUD_AI_TOKEN_AUDIENCE } from '#cloud/contract'
import { PGlite } from '@electric-sql/pglite'
import type { Page, Route } from '@playwright/test'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { PGliteDialect } from 'kysely-pglite-dialect'

import { cloudDiscoveryFixture } from '#tests/helpers/cloud/discovery'

const CLOUD = 'https://cloud.example.com'
const AI = 'https://ai.example.com'
const WORKSPACE_ID = '6f1c2d3e-4f50-4d7e-9a52-0b6f4f9e3c1a'
const ACCOUNT = { id: 'user-1', name: 'Ada', email: 'ada@example.com' }
export const CLOUD_AI_MODEL = 'Cloud Test Model'
export const CLOUD_AI_REPLY = 'Hello from Cloud'
/** What each reply costs: 100,000 input tokens at 3,000 credits per million. */
export const CLOUD_AI_REPLY_CREDITS = 300

interface CloudAIOptions {
  /** Credits the workspace's plan grants each month. */
  allowance: number
  /** Where the server sells credits; a self-hosted server has none. */
  billingURL?: string
}

/** The fake upstream's answer: a short streamed reply that reports its usage. */
function upstreamReply(): Response {
  const event = (data: object) => `data: ${JSON.stringify(data)}\n\n`
  const chunk = { id: 'cloud-test', object: 'chat.completion.chunk', created: 0, model: 'test' }
  return new Response(
    event({
      ...chunk,
      choices: [{ index: 0, delta: { role: 'assistant', content: CLOUD_AI_REPLY } }]
    }) +
      event({ ...chunk, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }) +
      event({ ...chunk, choices: [], usage: { prompt_tokens: 100_000, completion_tokens: 0 } }) +
      'data: [DONE]\n\n',
    { headers: { 'Content-Type': 'text/event-stream' } }
  )
}

/** The reference relay, with an in-memory database, Cloud's key, and the fake upstream. */
async function startRelay(appOrigin: string) {
  const pglite = await PGlite.create({ dataDir: 'memory://' })
  const database = createAIRelayDatabase(new PGliteDialect(pglite))
  await migrateAIRelayDatabase(database)
  const { privateKey, publicKey } = await generateKeyPair('ES256')
  const app = createAIRelayApp({
    config: parseAIRelayConfig(
      {
        schema_version: 1,
        relay: { cloud_url: CLOUD, allowed_origins: [appOrigin] },
        upstream: { base_url: 'https://upstream.example.com/v1' },
        catalog: {
          default_model: 'test/cloud-model',
          models: [
            {
              id: 'test/cloud-model',
              label: CLOUD_AI_MODEL,
              credits_per_million_input_tokens: 3000,
              credits_per_million_output_tokens: 15000,
              context_tokens: 200_000,
              tools: true
            }
          ]
        }
      },
      { DATABASE_URL: 'postgresql://unused', OPENPENCIL_AI_RELAY_UPSTREAM_KEY: 'upstream-key' }
    ),
    database,
    keys: createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'cloud' }] }),
    fetch: async () => upstreamReply()
  })
  return { app, privateKey, close: () => database.destroy() }
}

/** Cloud answers the editor's own origin with its session cookie, as a server listing it would. */
function cloudHeaders(appOrigin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': appOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  }
}

async function forward(route: Route, fetch: (request: Request) => Promise<Response> | Response) {
  const request = route.request()
  const body = request.postDataBuffer()
  const response = await fetch(
    new Request(request.url(), {
      method: request.method(),
      headers: request.headers(),
      body: body && request.method() !== 'GET' ? new Uint8Array(body) : undefined
    })
  )
  await route.fulfill({
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: Buffer.from(await response.arrayBuffer())
  })
}

/** The stubbed server on Home, remembering Ada's sign-in, as a `storageState` entry. */
export function cloudHomeStorage(): { name: string; value: string } {
  const serverId = createHash('sha256').update(CLOUD).digest('hex').slice(0, 32)
  return {
    name: 'open-pencil:cloud-servers',
    value: JSON.stringify({
      servers: [
        {
          id: serverId,
          url: CLOUD,
          kind: 'self-hosted',
          account: ACCOUNT,
          addedAt: '2026-10-01T00:00:00.000Z'
        }
      ],
      home: serverId
    })
  }
}

/**
 * A Cloud server, put on Home by `cloudHomeStorage`, with Ada signed in and one workspace whose
 * plan includes AI, advertising the reference relay. Cloud is stubbed; the relay is the real one, metering a fake
 * upstream, so the editor's requests, tokens, and the wallet go through the open contract.
 */
export async function routeCloudAI(page: Page, appOrigin: string, options: CloudAIOptions) {
  const relay = await startRelay(appOrigin)
  const now = new Date().toISOString()
  const discovery = {
    ...cloudDiscoveryFixture(CLOUD),
    ai: { endpoint: AI, contractVersion: CLOUD_AI_CONTRACT_VERSION },
    ...(options.billingURL ? { billing: { portalURL: options.billingURL } } : {})
  }
  const cloud: Record<string, () => unknown | Promise<unknown>> = {
    'GET /.well-known/openpencil': () => discovery,
    'GET /api/account/status': () => ({
      user: { userId: ACCOUNT.id, email: ACCOUNT.email, name: ACCOUNT.name },
      state: 'active'
    }),
    'GET /api/workspaces': () => ({
      workspaces: [
        {
          id: WORKSPACE_ID,
          name: 'Studio',
          slug: 'studio',
          role: 'editor',
          createdAt: now,
          updatedAt: now
        }
      ]
    }),
    [`GET /api/workspaces/${WORKSPACE_ID}/documents`]: () => ({ documents: [] }),
    [`GET /api/workspaces/${WORKSPACE_ID}/entitlements`]: () => ({
      entitlements: {
        features: {
          links: true,
          guestView: true,
          guestEdit: true,
          guestPresence: true,
          collaboration: true,
          revisionHistory: true,
          cloudAI: true
        },
        limits: {
          maximumFileBytes: 100_000_000,
          maximumStorageBytes: null,
          maximumParticipants: null,
          monthlyCreditAllowance: options.allowance
        },
        usage: { committedStorageBytes: 0, reservedStorageBytes: 0 }
      }
    }),
    'POST /api/ai/token': async () => {
      const expiresAt = new Date(Date.now() + 10 * 60_000)
      const token = await new SignJWT({
        workspaceId: WORKSPACE_ID,
        monthlyCreditAllowance: options.allowance
      })
        .setProtectedHeader({ alg: 'ES256', kid: 'cloud' })
        .setIssuer(CLOUD)
        .setAudience(CLOUD_AI_TOKEN_AUDIENCE)
        .setSubject(ACCOUNT.id)
        .setIssuedAt()
        .setExpirationTime(expiresAt)
        .sign(relay.privateKey)
      return { token, expiresAt: expiresAt.toISOString() }
    }
  }

  const unexpected: string[] = []
  await page.route(`${CLOUD}/**`, async (route) => {
    const request = route.request()
    const headers = cloudHeaders(appOrigin)
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const answer = cloud[`${request.method()} ${new URL(request.url()).pathname}`]
    if (!answer) {
      unexpected.push(`${request.method()} ${request.url()}`)
      return route.fulfill({ status: 404, headers, json: { error: { code: 'not_found' } } })
    }
    return route.fulfill({ headers, json: await answer() })
  })
  await page.route(`${AI}/**`, (route) => forward(route, (request) => relay.app.fetch(request)))

  return {
    /** Cloud requests the stub has no answer for, which a test expects to be none. */
    unexpected,
    close: relay.close
  }
}
