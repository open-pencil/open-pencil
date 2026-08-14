import { AI_PROVIDERS } from '@open-pencil/core/constants'
import type { AIProviderID, ModelOption } from '@open-pencil/core/constants'

import { readCacheJSON, writeCacheJSON } from '@/app/cache'

type OpenRouterModel = {
  id?: unknown
  name?: unknown
  supported_parameters?: unknown
  architecture?: {
    input_modalities?: unknown
  }
  top_provider?: {
    max_completion_tokens?: unknown
  }
}

type OpenRouterModelsResponse = {
  data?: OpenRouterModel[]
}

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
  const json = (await response.json()) as OpenRouterModelsResponse
  return json.data?.map(normalizeOpenRouterModel).filter((model) => model !== null) ?? []
}

async function listOpenRouterModels(fetcher: typeof fetch = fetch): Promise<ModelOption[]> {
  modelsPromise ??= (async () => {
    const cached = await readCacheJSON<ModelOption[]>(
      OPENROUTER_MODELS_CACHE_KEY,
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
