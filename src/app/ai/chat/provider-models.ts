import * as v from 'valibot'

import { AI_PROVIDERS } from '@open-pencil/core/constants'
import type { AIProviderID, ModelOption } from '@open-pencil/core/constants'

import { readCacheJSON, writeCacheJSON } from '@/app/cache'

const CachedModelOptions = v.array(
  v.object({
    id: v.string(),
    name: v.string(),
    tag: v.optional(v.string()),
    capabilities: v.optional(v.array(v.picklist(['tools', 'vision']))),
    recommendedMaxOutputTokens: v.optional(v.number()),
    releaseDate: v.optional(v.string()),
    status: v.optional(v.picklist(['active', 'beta', 'deprecated']))
  })
) satisfies v.GenericSchema<unknown, ModelOption[]>

const OpenRouterModelSchema = v.looseObject({
  id: v.optional(v.unknown()),
  name: v.optional(v.unknown()),
  supported_parameters: v.optional(v.unknown()),
  architecture: v.nullish(v.looseObject({ input_modalities: v.optional(v.unknown()) })),
  top_provider: v.nullish(v.looseObject({ max_completion_tokens: v.optional(v.unknown()) }))
})

type OpenRouterModel = v.InferOutput<typeof OpenRouterModelSchema>

// Entries are checked one by one in `fetchOpenRouterModels`, so one odd model keeps the rest.
const OpenRouterModelsResponseJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ data: v.optional(v.array(v.unknown())) })
)

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'
const OPENROUTER_MODELS_CACHE_KEY = 'openrouter/models'
const OPENROUTER_MODELS_CACHE_TTL_MS = 24 * 60 * 60 * 1000
function curatedProviderModels(providerID: AIProviderID) {
  return AI_PROVIDERS.find((provider) => provider.id === providerID)?.models ?? []
}

const curatedOpenRouterModels = curatedProviderModels('openrouter')

let modelsPromise: Promise<ModelOption[]> | null = null

function isToolCapableOpenRouterModel(model: OpenRouterModel) {
  return Array.isArray(model.supported_parameters) && model.supported_parameters.includes('tools')
}

export function normalizeOpenRouterModel(model: OpenRouterModel): ModelOption | null {
  if (!isToolCapableOpenRouterModel(model)) return null
  if (typeof model.id !== 'string' || !model.id) return null
  const inputModalities = model.architecture?.input_modalities
  const maxOutputTokens = model.top_provider?.max_completion_tokens
  return {
    id: model.id,
    name: typeof model.name === 'string' && model.name ? model.name : model.id,
    capabilities: [
      'tools',
      ...(Array.isArray(inputModalities) && inputModalities.includes('image')
        ? (['vision'] as const)
        : [])
    ],
    ...(typeof maxOutputTokens === 'number' && Number.isFinite(maxOutputTokens)
      ? { recommendedMaxOutputTokens: Math.min(128_000, Math.max(1024, maxOutputTokens)) }
      : {})
  }
}

async function fetchOpenRouterModels(fetcher: typeof fetch): Promise<ModelOption[]> {
  const response = await fetcher(OPENROUTER_MODELS_URL)
  if (!response.ok) throw new Error(`OpenRouter models request failed: ${response.status}`)
  const json = v.parse(OpenRouterModelsResponseJSON, await response.text())
  return (json.data ?? []).flatMap((entry) => {
    const model = v.is(OpenRouterModelSchema, entry) ? normalizeOpenRouterModel(entry) : null
    return model ? [model] : []
  })
}

async function listOpenRouterModels(fetcher: typeof fetch = fetch): Promise<ModelOption[]> {
  modelsPromise ??= (async () => {
    const cached = await readCacheJSON(
      OPENROUTER_MODELS_CACHE_KEY,
      CachedModelOptions,
      OPENROUTER_MODELS_CACHE_TTL_MS
    )
    if (cached?.length) return cached

    try {
      const models = await fetchOpenRouterModels(fetcher)
      if (!models.length) return curatedOpenRouterModels
      await writeCacheJSON(OPENROUTER_MODELS_CACHE_KEY, models)
      return models
    } catch {
      return curatedOpenRouterModels
    }
  })()

  return modelsPromise
}

export async function listProviderModels(
  providerID: AIProviderID,
  fetcher: typeof fetch = fetch
): Promise<ModelOption[]> {
  if (providerID === 'openrouter') return listOpenRouterModels(fetcher)
  return curatedProviderModels(providerID)
}
