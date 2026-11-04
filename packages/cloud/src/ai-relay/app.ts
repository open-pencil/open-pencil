import {
  AI_ERROR_STATUS,
  aiTokenClaimsSchema,
  CLOUD_AI_API_PATHS,
  CLOUD_AI_TOKEN_AUDIENCE,
  parseAIUsageQuery,
  type AIError,
  type AIErrorCode,
  type AITokenClaims
} from '#cloud/contract'
import { validatedQuery } from '#cloud/server/validation'
import { pick } from 'es-toolkit'
import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { jwtVerify, type JWTVerifyGetKey } from 'jose'
import type { Kysely } from 'kysely'
import * as v from 'valibot'

import type { AIRelayConfig } from './config'
import type { AIRelayDatabase } from './db'
import { creditsFor, meteredUsage } from './metering'
import { AIUsageCursorError, createAIUsageStore } from './usage'

export type AIRelayServices = {
  config: AIRelayConfig
  database: Kysely<AIRelayDatabase>
  /** Resolves Cloud's signing keys, normally `createRemoteJWKSet` on Cloud's JWKS. */
  keys: JWTVerifyGetKey
  /** Reaches the upstream model API. */
  fetch?: (input: string, init: RequestInit) => Promise<Response>
  now?: () => Date
  /**
   * Keeps metering alive after the answer is returned, as Workers' `waitUntil` does. Node runs the
   * promise to completion on its own.
   */
  waitUntil?: (promise: Promise<unknown>) => void
  onBackgroundError?: (error: unknown) => void
  upstreamTimeoutMs?: number
}

type AIRelayEnvironment = { Variables: { claims: AITokenClaims } }

const chatRequestSchema = v.looseObject({
  model: v.pipe(v.string(), v.minLength(1)),
  stream: v.optional(v.boolean())
})
const chatRequestBodySchema = v.pipe(v.string(), v.parseJson(), chatRequestSchema)

/**
 * The chat completion fields sent upstream. Routing and extension fields, such as OpenRouter's
 * `models` fallbacks, `provider`, and `plugins`, are dropped, so the relay's key runs only the
 * catalog model it charges for.
 */
const FORWARDED_FIELDS = [
  'model',
  'messages',
  'stream',
  'max_tokens',
  'max_completion_tokens',
  'temperature',
  'top_p',
  'frequency_penalty',
  'presence_penalty',
  'stop',
  'seed',
  'tools',
  'tool_choice',
  'parallel_tool_calls',
  'response_format',
  'reasoning_effort',
  'reasoning'
] as const

/** How long an upstream answer may take in all, streamed or not, so a stalled one cannot hold a request slot forever. */
const DEFAULT_UPSTREAM_TIMEOUT_MS = 10 * 60_000

function aiError(
  context: Context,
  code: AIErrorCode,
  details: Omit<AIError['error'], 'code'> = {}
) {
  return context.json({ error: { code, ...details } }, AI_ERROR_STATUS[code])
}

/** Counts each workspace's model requests in flight, within one process. */
function concurrencyLimiter(maximum: number) {
  const inFlight = new Map<string, number>()
  return {
    acquire(workspaceId: string): (() => void) | null {
      const count = inFlight.get(workspaceId) ?? 0
      if (count >= maximum) return null
      inFlight.set(workspaceId, count + 1)
      let released = false
      return () => {
        if (released) return
        released = true
        const remaining = (inFlight.get(workspaceId) ?? 1) - 1
        if (remaining > 0) inFlight.set(workspaceId, remaining)
        else inFlight.delete(workspaceId)
      }
    }
  }
}

/**
 * The reference AI service: it verifies Cloud-signed tokens, proxies chat completions to one
 * OpenAI-compatible upstream with one key, and holds each workspace to its monthly allowance.
 * A request is admitted while the workspace has credits left and charged once its usage is known,
 * so concurrent requests can overdraw the allowance by what they cost.
 */
export function createAIRelayApp(services: AIRelayServices) {
  const { config } = services
  const upstreamFetch = services.fetch ?? ((input, init) => fetch(input, init))
  const now = services.now ?? (() => new Date())
  const usage = createAIUsageStore(services.database)
  const models = new Map(config.catalog.models.map((model) => [model.id, model]))
  const limiter = concurrencyLimiter(config.maximumConcurrentRequests)
  const allowedOrigins = new Set(config.allowedOrigins)
  const reportBackgroundError =
    services.onBackgroundError ??
    ((error: unknown) => console.error('[AI relay] Metering failed:', error))

  const requireToken = async (context: Context<AIRelayEnvironment>, next: () => Promise<void>) => {
    const header = context.req.header('Authorization')
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined
    if (!token) return aiError(context, 'unauthorized')
    try {
      const { payload } = await jwtVerify(token, services.keys, {
        issuer: config.cloudURL,
        audience: CLOUD_AI_TOKEN_AUDIENCE,
        algorithms: ['ES256']
      })
      context.set('claims', v.parse(aiTokenClaimsSchema, payload))
    } catch {
      return aiError(context, 'unauthorized')
    }
    return next()
  }

  return new Hono<AIRelayEnvironment>()
    .use(
      '*',
      cors({
        origin: (origin) => (allowedOrigins.has(origin) ? origin : null),
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: 600
      })
    )
    .use(`${CLOUD_AI_API_PATHS.base}/*`, requireToken)
    .get(CLOUD_AI_API_PATHS.catalog, (context) => context.json(config.catalog))
    .get(CLOUD_AI_API_PATHS.wallet, async (context) => {
      const claims = context.get('claims')
      return context.json(
        await usage.wallet(claims.workspaceId, claims.monthlyCreditAllowance, now())
      )
    })
    .get(CLOUD_AI_API_PATHS.usage, validatedQuery(parseAIUsageQuery), async (context) => {
      try {
        return context.json(
          await usage.page(context.get('claims').workspaceId, context.req.valid('query').cursor)
        )
      } catch (error) {
        if (error instanceof AIUsageCursorError) {
          return context.json({ error: { code: 'invalid_request' as const } }, 400)
        }
        throw error
      }
    })
    .post(
      CLOUD_AI_API_PATHS.chatCompletions,
      // Counted as it streams in, so a body without Content-Length is bounded too.
      bodyLimit({
        maxSize: config.maximumRequestBytes,
        onError: (context) => context.json({ error: { code: 'invalid_request' as const } }, 413)
      }),
      async (context) => {
        const claims = context.get('claims')
        const parsed = v.safeParse(chatRequestBodySchema, await context.req.text())
        if (!parsed.success)
          return context.json({ error: { code: 'invalid_request' as const } }, 400)
        const request = pick(parsed.output, FORWARDED_FIELDS)
        const model = models.get(request.model)
        if (!model) return aiError(context, 'model_not_allowed')
        const wallet = await usage.wallet(claims.workspaceId, claims.monthlyCreditAllowance, now())
        if (wallet.balance === 0) {
          return aiError(context, 'insufficient_credits', {
            resetsAt: wallet.buckets[0]?.expiresAt ?? undefined
          })
        }
        const release = limiter.acquire(claims.workspaceId)
        if (!release) return aiError(context, 'rate_limited')

        const streamed = request.stream === true
        let upstream: Response
        try {
          upstream = await upstreamFetch(`${config.upstreamURL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.upstreamKey}`
            },
            body: JSON.stringify(
              streamed ? { ...request, stream_options: { include_usage: true } } : request
            ),
            // Aborting also errors a stream in progress, so metering ends and frees the slot.
            signal: AbortSignal.timeout(services.upstreamTimeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS)
          })
        } catch (error) {
          release()
          throw error
        }
        const headers = new Headers()
        const contentType = upstream.headers.get('Content-Type')
        if (contentType) headers.set('Content-Type', contentType)
        if (streamed) headers.set('Cache-Control', 'no-cache')
        if (!upstream.ok || !upstream.body) {
          release()
          return new Response(upstream.body, { status: upstream.status, headers })
        }

        // The metering branch reads to the end even if the editor disconnects, so the request is
        // still charged for what the upstream generated.
        const [answer, metered] = upstream.body.tee()
        const settle = async () => {
          const tokens = await meteredUsage(metered, streamed)
          // An upstream that reports no usage leaves the request uncharged, so operators hear of it.
          if (!tokens)
            throw new Error(`The upstream reported no usage for ${model.id}; not charged`)
          await usage.record({
            id: crypto.randomUUID(),
            workspaceId: claims.workspaceId,
            userId: claims.sub,
            modelId: model.id,
            inputTokens: tokens.inputTokens,
            outputTokens: tokens.outputTokens,
            credits: creditsFor(model, tokens),
            createdAt: now()
          })
        }
        const settled = settle().catch(reportBackgroundError).finally(release)
        services.waitUntil?.(settled)
        // The answer ends once its charge is recorded, so a wallet read after it includes the charge.
        const charged = answer.pipeThrough(new TransformStream({ flush: () => settled }))
        return new Response(charged, { status: upstream.status, headers })
      }
    )
}

export type AIRelayApp = ReturnType<typeof createAIRelayApp>
