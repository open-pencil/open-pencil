import { afterEach, describe, expect, test } from 'bun:test'

import { responseJSON } from '#cloud-tests/helpers/response'
import {
  createAIRelayApp,
  createAIRelayDatabase,
  migrateAIRelayDatabase,
  parseAIRelayConfig,
  type AIRelayConfigInput
} from '#cloud/ai-relay'
import {
  aiCatalogSchema,
  aiErrorSchema,
  aiUsagePageSchema,
  aiWalletSchema,
  CLOUD_AI_API_PATHS,
  CLOUD_AI_TOKEN_AUDIENCE
} from '#cloud/contract'
import { PGlite } from '@electric-sql/pglite'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { InsertQueryNode, type KyselyPlugin, type QueryId } from 'kysely'
import { PGliteDialect } from 'kysely-pglite-dialect'
import * as v from 'valibot'

const CLOUD = 'https://cloud.example.com'
const APP = 'https://app.example.com'
const MODEL = 'anthropic/claude-sonnet-5-5'
const NOW = new Date('2026-10-21T12:00:00Z')

const configInput: AIRelayConfigInput = {
  schema_version: 1,
  relay: { cloud_url: CLOUD, allowed_origins: [APP], max_concurrent_requests: 1 },
  upstream: { base_url: 'https://upstream.example.com/api/v1' },
  catalog: {
    default_model: MODEL,
    models: [
      {
        id: MODEL,
        label: 'Claude Sonnet 5.5',
        credits_per_million_input_tokens: 3000,
        credits_per_million_output_tokens: 15000,
        context_tokens: 1_000_000
      }
    ]
  }
}

type UpstreamCall = {
  url: string
  authorization: string | null
  body: { [key: string]: unknown }
  signal: AbortSignal | null | undefined
}

const closers: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const close of closers.splice(0)) await close()
})

function streamOf(...events: unknown[]): string {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n'
}

/** Holds every insert's result until `gate` resolves, so a test decides when a charge is recorded. */
function holdInserts(gate: Promise<void>): KyselyPlugin {
  const inserts = new Set<QueryId>()
  return {
    transformQuery({ node, queryId }) {
      if (InsertQueryNode.is(node)) inserts.add(queryId)
      return node
    },
    async transformResult({ result, queryId }) {
      if (inserts.delete(queryId)) await gate
      return result
    }
  }
}

async function relay(
  upstream: (call: UpstreamCall) => Response = () => Response.json({}),
  options: { upstreamTimeoutMs?: number; maxRequestBytes?: number; chargeGate?: Promise<void> } = {}
) {
  const pglite = await PGlite.create({ dataDir: 'memory://' })
  const database = createAIRelayDatabase(new PGliteDialect(pglite))
  closers.push(() => database.destroy())
  await migrateAIRelayDatabase(database)

  const { privateKey, publicKey } = await generateKeyPair('ES256')
  const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'cloud' }] })
  const calls: UpstreamCall[] = []
  const settled: Promise<unknown>[] = []
  const backgroundErrors: unknown[] = []
  const app = createAIRelayApp({
    config: parseAIRelayConfig(
      {
        ...configInput,
        relay: { ...configInput.relay, max_request_bytes: options.maxRequestBytes }
      },
      {
        DATABASE_URL: 'postgresql://unused',
        OPENPENCIL_AI_RELAY_UPSTREAM_KEY: 'upstream-key'
      }
    ),
    database: options.chargeGate ? database.withPlugin(holdInserts(options.chargeGate)) : database,
    keys,
    now: () => NOW,
    upstreamTimeoutMs: options.upstreamTimeoutMs,
    waitUntil: (promise) => settled.push(promise),
    onBackgroundError: (error) => backgroundErrors.push(error),
    fetch: async (input, init) => {
      const call = {
        url: input,
        authorization: new Headers(init.headers).get('Authorization'),
        body: v.parse(v.pipe(v.string(), v.parseJson(), v.looseObject({})), init.body),
        signal: init.signal
      }
      calls.push(call)
      return upstream(call)
    }
  })

  const workspaceId = crypto.randomUUID()
  async function token(
    claims: { monthlyCreditAllowance?: number | null; workspaceId?: string } = {},
    options: { issuer?: string; signingKey?: CryptoKey } = {}
  ) {
    return new SignJWT({
      workspaceId: claims.workspaceId ?? workspaceId,
      monthlyCreditAllowance:
        claims.monthlyCreditAllowance === undefined ? 1000 : claims.monthlyCreditAllowance
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'cloud' })
      .setIssuer(options.issuer ?? CLOUD)
      .setAudience(CLOUD_AI_TOKEN_AUDIENCE)
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(options.signingKey ?? privateKey)
  }
  const request = async (path: string, bearer: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }
    })
  const complete = async (bearer: string, body: Record<string, unknown>) =>
    request(CLOUD_AI_API_PATHS.chatCompletions, bearer, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  return { app, calls, settled, backgroundErrors, token, request, complete, workspaceId }
}

describe('AI relay', () => {
  test('refuses requests without a token Cloud signed for this service', async () => {
    const context = await relay()
    const { privateKey: otherKey } = await generateKeyPair('ES256')
    const refused = [
      await context.app.request(CLOUD_AI_API_PATHS.catalog),
      await context.request(CLOUD_AI_API_PATHS.catalog, 'not-a-token'),
      await context.request(
        CLOUD_AI_API_PATHS.catalog,
        await context.token({}, { issuer: 'https://other.example.com' })
      ),
      await context.request(
        CLOUD_AI_API_PATHS.catalog,
        await context.token({}, { signingKey: otherKey })
      )
    ]
    for (const response of refused) {
      expect(response.status).toBe(401)
      expect((await responseJSON(response, aiErrorSchema)).error.code).toBe('unauthorized')
    }
    const catalog = await context.request(CLOUD_AI_API_PATHS.catalog, await context.token())
    expect((await responseJSON(catalog, aiCatalogSchema)).defaultModelID).toBe(MODEL)
  })

  test('proxies a completion with the upstream key and charges its usage', async () => {
    const context = await relay(() =>
      Response.json({
        choices: [{ message: { role: 'assistant', content: 'Hi' } }],
        usage: { prompt_tokens: 100_000, completion_tokens: 10_000 }
      })
    )
    const bearer = await context.token()
    const response = await context.complete(bearer, {
      model: MODEL,
      messages: [{ role: 'user', content: 'Hello' }]
    })
    expect(response.status).toBe(200)
    expect(context.calls).toEqual([
      {
        url: 'https://upstream.example.com/api/v1/chat/completions',
        authorization: 'Bearer upstream-key',
        body: { model: MODEL, messages: [{ role: 'user', content: 'Hello' }] },
        signal: expect.any(AbortSignal)
      }
    ])
    expect(await response.json()).toMatchObject({ choices: [{ message: { content: 'Hi' } }] })
    await Promise.all(context.settled)

    // 100k input tokens at 3,000 and 10k output tokens at 15,000 credits per million.
    const wallet = await responseJSON(
      await context.request(CLOUD_AI_API_PATHS.wallet, bearer),
      aiWalletSchema
    )
    expect(wallet).toEqual({
      balance: 550,
      buckets: [{ kind: 'allowance', remaining: 550, expiresAt: '2026-11-01T00:00:00.000Z' }]
    })
    const usage = await responseJSON(
      await context.request(CLOUD_AI_API_PATHS.usage, bearer),
      aiUsagePageSchema
    )
    expect(usage.entries).toMatchObject([
      { kind: 'model', modelID: MODEL, userId: 'user-1', credits: 450 }
    ])
    expect(usage.next).toBeNull()
  })

  test('reports a completion the upstream gives no usage for, which goes uncharged', async () => {
    const context = await relay(() =>
      Response.json({ choices: [{ message: { role: 'assistant', content: 'Hi' } }] })
    )
    const bearer = await context.token()
    const response = await context.complete(bearer, { model: MODEL, messages: [] })
    expect(response.status).toBe(200)
    await response.text()
    await Promise.all(context.settled)

    expect(context.backgroundErrors).toHaveLength(1)
    const usage = await responseJSON(
      await context.request(CLOUD_AI_API_PATHS.usage, bearer),
      aiUsagePageSchema
    )
    expect(usage.entries).toEqual([])
  })

  test('asks a streamed completion for usage and charges it before the answer ends', async () => {
    let recordCharge: (() => void) | undefined
    const charge = new Promise<void>((resolve) => {
      recordCharge = resolve
    })
    const context = await relay(
      () =>
        new Response(
          streamOf(
            { choices: [{ delta: { content: 'Hi' } }] },
            { choices: [], usage: { prompt_tokens: 1000, completion_tokens: 1000 } }
          ),
          { headers: { 'Content-Type': 'text/event-stream' } }
        ),
      { chargeGate: charge }
    )
    const bearer = await context.token()
    const response = await context.complete(bearer, {
      model: MODEL,
      stream: true,
      stream_options: { keep: true },
      messages: []
    })
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(context.calls[0]?.body.stream_options).toEqual({ include_usage: true })
    // The answer ends only once its charge is recorded, so a wallet read after it includes it.
    let answered = false
    const text = response.text().then((body) => {
      answered = true
      return body
    })
    await Bun.sleep(50)
    expect(answered).toBe(false)
    recordCharge?.()
    expect(await text).toContain('"content":"Hi"')
    const wallet = await responseJSON(
      await context.request(CLOUD_AI_API_PATHS.wallet, bearer),
      aiWalletSchema
    )
    expect(wallet.balance).toBe(1000 - 18)
  })

  test('refuses models outside the catalog and workspaces with no credits left', async () => {
    const context = await relay(() =>
      Response.json({ choices: [], usage: { prompt_tokens: 1_000_000, completion_tokens: 0 } })
    )
    const notAllowed = await context.complete(await context.token(), { model: 'other/model' })
    expect(notAllowed.status).toBe(403)
    expect((await responseJSON(notAllowed, aiErrorSchema)).error.code).toBe('model_not_allowed')

    // The first request is admitted with credits left and overdraws the allowance.
    const bearer = await context.token()
    expect((await context.complete(bearer, { model: MODEL })).status).toBe(200)
    await Promise.all(context.settled)
    const exhausted = await context.complete(bearer, { model: MODEL })
    expect(exhausted.status).toBe(402)
    // It says when the allowance renews, so the editor need not guess the relay's period.
    expect((await responseJSON(exhausted, aiErrorSchema)).error).toEqual({
      code: 'insufficient_credits',
      resetsAt: '2026-11-01T00:00:00.000Z'
    })
    expect(context.calls).toHaveLength(1)

    // Another workspace, and one without an allowance, are unaffected.
    const other = await context.token({ workspaceId: crypto.randomUUID() })
    expect((await context.complete(other, { model: MODEL })).status).toBe(200)
    const unlimited = await context.token({ monthlyCreditAllowance: null })
    const wallet = await responseJSON(
      await context.request(CLOUD_AI_API_PATHS.wallet, unlimited),
      aiWalletSchema
    )
    expect(wallet).toEqual({ balance: null, buckets: [] })
    expect((await context.complete(unlimited, { model: MODEL })).status).toBe(200)
  })

  test('limits a workspace to its concurrent requests until metering settles', async () => {
    let finish: (() => void) | undefined
    const context = await relay(
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              finish = () => {
                controller.enqueue(new TextEncoder().encode('{"choices":[]}'))
                controller.close()
              }
            }
          })
        )
    )
    const bearer = await context.token()
    const first = await context.complete(bearer, { model: MODEL })
    expect(first.status).toBe(200)
    const second = await context.complete(bearer, { model: MODEL })
    expect(second.status).toBe(429)
    expect((await responseJSON(second, aiErrorSchema)).error.code).toBe('rate_limited')
    finish?.()
    await first.text()
    await Promise.all(context.settled)
    expect((await context.complete(bearer, { model: MODEL })).status).toBe(200)
  })

  test('passes upstream failures through and frees the request slot', async () => {
    const context = await relay(() =>
      Response.json({ error: { message: 'Upstream is down' } }, { status: 503 })
    )
    const bearer = await context.token()
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await context.complete(bearer, { model: MODEL })
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ error: { message: 'Upstream is down' } })
    }
    expect((await context.complete(bearer, { messages: [] })).status).toBe(400)
  })

  test('answers browsers only from allowed origins', async () => {
    const context = await relay()
    const preflight = (origin: string) =>
      context.app.request(CLOUD_AI_API_PATHS.chatCompletions, {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization,content-type'
        }
      })
    const allowed = await preflight(APP)
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(APP)
    expect(allowed.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
    expect(
      (await preflight('https://evil.example.com')).headers.get('Access-Control-Allow-Origin')
    ).toBeNull()
  })

  test('pages usage newest first and rejects a malformed cursor', async () => {
    const context = await relay(() =>
      Response.json({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 0 } })
    )
    const bearer = await context.token({ monthlyCreditAllowance: null })
    for (let index = 0; index < 51; index++) {
      await context.complete(bearer, { model: MODEL })
      await Promise.all(context.settled.splice(0))
    }
    const first = await responseJSON(
      await context.request(CLOUD_AI_API_PATHS.usage, bearer),
      aiUsagePageSchema
    )
    expect(first.entries).toHaveLength(50)
    expect(first.next).not.toBeNull()
    const second = await responseJSON(
      await context.request(
        `${CLOUD_AI_API_PATHS.usage}?cursor=${encodeURIComponent(first.next ?? '')}`,
        bearer
      ),
      aiUsagePageSchema
    )
    expect(second.entries).toHaveLength(1)
    expect(second.next).toBeNull()
    const seen = new Set([...first.entries, ...second.entries].map((entry) => entry.id))
    expect(seen.size).toBe(51)
    for (const cursor of ['12.not-an-id', `99999999999999999.${crypto.randomUUID()}`]) {
      expect(
        (await context.request(`${CLOUD_AI_API_PATHS.usage}?cursor=${cursor}`, bearer)).status
      ).toBe(400)
    }
  })

  test('forwards only chat completion fields, so routing fields cannot reach other models', async () => {
    const context = await relay(() => Response.json({ choices: [] }))
    await context.complete(await context.token(), {
      model: MODEL,
      messages: [{ role: 'user', content: 'Hi' }],
      tools: [],
      temperature: 0.2,
      models: ['other/expensive-model'],
      provider: { order: ['other'] },
      plugins: [{ id: 'web' }],
      route: 'fallback',
      user: 'someone'
    })
    expect(context.calls[0]?.body).toEqual({
      model: MODEL,
      messages: [{ role: 'user', content: 'Hi' }],
      tools: [],
      temperature: 0.2
    })
  })

  test('refuses a body past the size limit, even without Content-Length, before the upstream', async () => {
    const context = await relay(undefined, { maxRequestBytes: 1024 })
    const bearer = await context.token()
    const oversized = new TextEncoder().encode(
      JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: 'x'.repeat(4096) }] })
    )
    const response = await context.request(CLOUD_AI_API_PATHS.chatCompletions, bearer, {
      method: 'POST',
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(oversized)
          controller.close()
        }
      })
    })
    expect(response.status).toBe(413)
    expect(context.calls).toHaveLength(0)
    expect((await context.complete(bearer, { model: MODEL, messages: [] })).status).not.toBe(413)
  })

  test('gives up on a stalled upstream and frees its request slot', async () => {
    const context = await relay(
      ({ signal }) =>
        new Response(
          new ReadableStream({
            start(controller) {
              signal?.addEventListener('abort', () => controller.error(signal.reason))
            }
          })
        ),
      { upstreamTimeoutMs: 50 }
    )
    const bearer = await context.token()
    const stalled = await context.complete(bearer, { model: MODEL })
    expect(stalled.status).toBe(200)
    expect(context.calls[0]?.signal).toBeInstanceOf(AbortSignal)
    await Promise.all(context.settled)
    await stalled.text().catch(() => undefined)
    expect(context.backgroundErrors).toHaveLength(1)
    expect((await context.complete(bearer, { model: MODEL })).status).toBe(200)
  })
})
