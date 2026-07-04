import { AI_PROVIDERS } from '@open-pencil/core/constants'
import type { AIProviderID, ModelOption } from '@open-pencil/core/constants'

import { readCacheJson, writeCacheJson } from '@/app/cache'

type OpenRouterModel = {
  id?: unknown
  name?: unknown
  supported_parameters?: unknown
}

type OpenRouterModelsResponse = {
  data?: OpenRouterModel[]
}

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'
const OPENROUTER_MODELS_CACHE_KEY = 'openrouter/models'
const OPENROUTER_MODELS_CACHE_TTL_MS = 24 * 60 * 60 * 1000

const REQUESTY_MODELS_URL = 'https://router.requesty.ai/v1/models'
const REQUESTY_MODELS_CACHE_KEY = 'requesty/models'
const REQUESTY_MODELS_CACHE_TTL_MS = 24 * 60 * 60 * 1000
function curatedProviderModels(providerID: AIProviderID) {
  return AI_PROVIDERS.find((provider) => provider.id === providerID)?.models ?? []
}

const curatedOpenRouterModels = curatedProviderModels('openrouter')
const curatedRequestyModels = curatedProviderModels('requesty')

let modelsPromise: Promise<ModelOption[]> | null = null
let requestyModelsPromise: Promise<ModelOption[]> | null = null

function isToolCapableOpenRouterModel(model: OpenRouterModel) {
  return Array.isArray(model.supported_parameters) && model.supported_parameters.includes('tools')
}

export function normalizeOpenRouterModel(model: OpenRouterModel): ModelOption | null {
  if (!isToolCapableOpenRouterModel(model)) return null
  if (typeof model.id !== 'string' || !model.id) return null
  return {
    id: model.id,
    name: typeof model.name === 'string' && model.name ? model.name : model.id
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
    const cached = await readCacheJson<ModelOption[]>(
      OPENROUTER_MODELS_CACHE_KEY,
      OPENROUTER_MODELS_CACHE_TTL_MS
    )
    if (cached?.length) return cached

    try {
      const models = await fetchOpenRouterModels(fetcher)
      if (!models.length) return curatedOpenRouterModels
      await writeCacheJson(OPENROUTER_MODELS_CACHE_KEY, models)
      return models
    } catch {
      return curatedOpenRouterModels
    }
  })()

  return modelsPromise
}

type RequestyModel = {
  id?: unknown
  name?: unknown
}

type RequestyModelsResponse = {
  data?: RequestyModel[]
}

function normalizeRequestyModel(model: RequestyModel): ModelOption | null {
  if (typeof model.id !== 'string' || !model.id) return null
  return {
    id: model.id,
    name: typeof model.name === 'string' && model.name ? model.name : model.id
  }
}

async function fetchRequestyModels(fetcher: typeof fetch): Promise<ModelOption[]> {
  const response = await fetcher(REQUESTY_MODELS_URL)
  if (!response.ok) throw new Error(`Requesty models request failed: ${response.status}`)
  const json = (await response.json()) as RequestyModelsResponse
  return json.data?.map(normalizeRequestyModel).filter((model) => model !== null) ?? []
}

async function listRequestyModels(fetcher: typeof fetch = fetch): Promise<ModelOption[]> {
  requestyModelsPromise ??= (async () => {
    const cached = await readCacheJson<ModelOption[]>(
      REQUESTY_MODELS_CACHE_KEY,
      REQUESTY_MODELS_CACHE_TTL_MS
    )
    if (cached?.length) return cached

    try {
      const models = await fetchRequestyModels(fetcher)
      if (!models.length) return curatedRequestyModels
      await writeCacheJson(REQUESTY_MODELS_CACHE_KEY, models)
      return models
    } catch {
      return curatedRequestyModels
    }
  })()

  return requestyModelsPromise
}

export async function listProviderModels(
  providerID: AIProviderID,
  fetcher: typeof fetch = fetch
): Promise<ModelOption[]> {
  if (providerID === 'openrouter') return listOpenRouterModels(fetcher)
  if (providerID === 'requesty') return listRequestyModels(fetcher)
  return curatedProviderModels(providerID)
}
