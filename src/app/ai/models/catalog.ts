import type { AIProviderID, ModelOption } from '@open-pencil/core/constants'

import { readCacheJSON, writeCacheJSON } from '@/app/cache'

const MODELS_DEV_URL = 'https://models.dev/api.json'
const MODELS_DEV_CACHE_KEY = 'models-dev/catalog'
const MODELS_DEV_CACHE_TTL_MS = 24 * 60 * 60 * 1000

const PROVIDER_KEYS: Partial<Record<AIProviderID, readonly string[]>> = {
  openrouter: ['openrouter'],
  anthropic: ['anthropic'],
  openai: ['openai'],
  google: ['google'],
  deepseek: ['deepseek'],
  zai: ['zhipuai'],
  minimax: ['minimax']
}

type ModelsDevModel = {
  id?: unknown
  name?: unknown
  attachment?: unknown
  tool_call?: unknown
  limit?: { output?: unknown }
}

type ModelsDevProvider = {
  models?: Record<string, ModelsDevModel>
}

type ModelsDevCatalog = Record<string, ModelsDevProvider>

let catalogPromise: Promise<ModelsDevCatalog | null> | null = null

function normalizeModel(id: string, model: ModelsDevModel): ModelOption {
  const capabilities: ('tools' | 'vision')[] = []
  if (model.tool_call === true) capabilities.push('tools')
  if (model.attachment === true) capabilities.push('vision')
  const output = model.limit?.output
  return {
    id,
    name: typeof model.name === 'string' && model.name ? model.name : id,
    capabilities,
    ...(typeof output === 'number' && Number.isFinite(output)
      ? { recommendedMaxOutputTokens: Math.min(128_000, Math.max(1024, output)) }
      : {})
  }
}

async function loadCatalog(fetcher: typeof fetch): Promise<ModelsDevCatalog | null> {
  const cached = await readCacheJSON<ModelsDevCatalog>(
    MODELS_DEV_CACHE_KEY,
    MODELS_DEV_CACHE_TTL_MS
  )
  if (cached) return cached
  try {
    const response = await fetcher(MODELS_DEV_URL)
    if (!response.ok) throw new Error(`models.dev catalog request failed: ${response.status}`)
    const catalog = (await response.json()) as ModelsDevCatalog
    await writeCacheJSON(MODELS_DEV_CACHE_KEY, catalog)
    return catalog
  } catch {
    return null
  }
}

function modelIDCandidates(providerKey: string, modelID: string): string[] {
  const unprefixed = modelID.startsWith(`${providerKey}/`)
    ? modelID.slice(providerKey.length + 1)
    : modelID
  return [
    ...new Set([
      modelID,
      unprefixed,
      unprefixed.replace(/-\d{8}$/, ''),
      unprefixed.replace(/:[a-z0-9-]+$/, '')
    ])
  ]
}

export async function resolveModelsDevModel(
  providerID: AIProviderID,
  modelID: string,
  fetcher: typeof fetch = fetch
): Promise<ModelOption | null> {
  const providerKeys = PROVIDER_KEYS[providerID]
  if (!providerKeys?.length || !modelID) return null
  catalogPromise ??= loadCatalog(fetcher)
  const catalog = await catalogPromise
  if (!catalog) return null

  for (const providerKey of providerKeys) {
    const models = catalog[providerKey]?.models
    for (const candidate of modelIDCandidates(providerKey, modelID)) {
      const matched = models?.[candidate]
      if (matched) return normalizeModel(modelID, matched)
    }
  }
  return null
}

export function resetModelsDevCatalogForTests(): void {
  catalogPromise = null
}
