import { aiCatalogSchema, type AICatalog } from '#cloud/contract'
import { httpURLSchema } from '#cloud/server/config/schema'
import { parse as parseTOML } from 'smol-toml'
import * as v from 'valibot'

export type AIRelayEnvironment = Readonly<Record<string, string | undefined>>

export type AIRelayConfig = {
  /** The Cloud whose tokens the relay accepts: their issuer, and where its keys are published. */
  cloudURL: string
  /** Browser origins allowed to call the relay; the desktop editor is not subject to CORS. */
  allowedOrigins: string[]
  /** Model requests a workspace may have in flight at once. */
  maximumConcurrentRequests: number
  /** The largest model request body accepted, in bytes. */
  maximumRequestBytes: number
  databaseURL: string
  /** An OpenAI-compatible API base URL, such as `https://openrouter.ai/api/v1`. */
  upstreamURL: string
  upstreamKey: string
  catalog: AICatalog
}

export class AIRelayConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AIRelayConfigError'
  }
}

const DEFAULT_SECRET_NAMES = {
  databaseURL: 'DATABASE_URL',
  upstreamKey: 'OPENPENCIL_AI_RELAY_UPSTREAM_KEY'
} as const

const textSchema = v.pipe(v.string(), v.trim(), v.minLength(1))
const creditsSchema = v.pipe(v.number(), v.integer(), v.minValue(0))
const secretReferenceSchema = v.object({ from_env: textSchema })
const defaultReference = (name: string) => v.optional(secretReferenceSchema, { from_env: name })

const modelSchema = v.object({
  id: textSchema,
  label: textSchema,
  credits_per_million_input_tokens: creditsSchema,
  credits_per_million_output_tokens: creditsSchema,
  context_tokens: v.pipe(v.number(), v.integer(), v.minValue(1)),
  reasoning: v.optional(v.boolean(), false),
  vision: v.optional(v.boolean(), false),
  tools: v.optional(v.boolean(), true)
})

const aiRelayConfigSchema = v.object({
  schema_version: v.literal(1),
  relay: v.object({
    cloud_url: httpURLSchema,
    allowed_origins: v.optional(v.array(httpURLSchema), []),
    max_concurrent_requests: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 4),
    // Room for the images a vision request carries inline.
    max_request_bytes: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 16 * 1024 * 1024)
  }),
  database: v.optional(v.object({ url: defaultReference(DEFAULT_SECRET_NAMES.databaseURL) }), {
    url: { from_env: DEFAULT_SECRET_NAMES.databaseURL }
  }),
  upstream: v.object({
    base_url: httpURLSchema,
    api_key: defaultReference(DEFAULT_SECRET_NAMES.upstreamKey)
  }),
  catalog: v.object({
    default_model: textSchema,
    models: v.pipe(v.array(modelSchema), v.minLength(1))
  })
})

export type AIRelayConfigInput = v.InferInput<typeof aiRelayConfigSchema>

function requiredSecret(environment: AIRelayEnvironment, name: string): string {
  const value = environment[name]
  if (!value) throw new AIRelayConfigError(`Required secret binding is unavailable: ${name}`)
  return value
}

function catalogFrom(input: v.InferOutput<typeof aiRelayConfigSchema>['catalog']): AICatalog {
  const ids = new Set<string>()
  for (const model of input.models) {
    if (ids.has(model.id)) throw new AIRelayConfigError(`Model ${model.id} is listed twice`)
    ids.add(model.id)
  }
  if (!ids.has(input.default_model)) {
    throw new AIRelayConfigError(`Default model ${input.default_model} is not in the catalog`)
  }
  return v.parse(aiCatalogSchema, {
    defaultModelID: input.default_model,
    models: input.models.map((model) => ({
      id: model.id,
      label: model.label,
      creditsPerMillionInputTokens: model.credits_per_million_input_tokens,
      creditsPerMillionOutputTokens: model.credits_per_million_output_tokens,
      contextTokens: model.context_tokens,
      capabilities: { reasoning: model.reasoning, vision: model.vision, tools: model.tools }
    }))
  })
}

export function parseAIRelayConfig(input: unknown, environment: AIRelayEnvironment): AIRelayConfig {
  const config = v.parse(aiRelayConfigSchema, input)
  return {
    cloudURL: new URL(config.relay.cloud_url).origin,
    allowedOrigins: config.relay.allowed_origins.map((origin) => new URL(origin).origin),
    maximumConcurrentRequests: config.relay.max_concurrent_requests,
    maximumRequestBytes: config.relay.max_request_bytes,
    databaseURL: requiredSecret(environment, config.database.url.from_env),
    upstreamURL: config.upstream.base_url.replace(/\/+$/, ''),
    upstreamKey: requiredSecret(environment, config.upstream.api_key.from_env),
    catalog: catalogFrom(config.catalog)
  }
}

export function parseAIRelayTOML(source: string, environment: AIRelayEnvironment): AIRelayConfig {
  return parseAIRelayConfig(parseTOML(source), environment)
}
