import { AI_PROVIDERS } from '@open-pencil/core/constants'
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
  status?: unknown
  release_date?: unknown
  modalities?: { output?: unknown }
  limit?: { output?: unknown }
}

type ModelsDevProvider = {
  models?: Record<string, ModelsDevModel>
}

type ModelsDevCatalog = Record<string, ModelsDevProvider>

let catalogPromise: Promise<ModelsDevCatalog | null> | null = null

function normalizedStatus(status: unknown): ModelOption['status'] {
  if (status === 'beta' || status === 'deprecated') return status
  return 'active'
}

function normalizeModel(id: string, model: ModelsDevModel): ModelOption {
  const capabilities: ('tools' | 'vision')[] = []
  if (model.tool_call === true) capabilities.push('tools')
  if (model.attachment === true) capabilities.push('vision')
  const normalized: ModelOption = {
    id,
    name: typeof model.name === 'string' && model.name ? model.name : id,
    capabilities,
    status: normalizedStatus(model.status)
  }
  const output = model.limit?.output
  if (typeof output === 'number' && Number.isFinite(output)) {
    normalized.recommendedMaxOutputTokens = Math.min(128_000, Math.max(1024, output))
  }
  if (typeof model.release_date === 'string') normalized.releaseDate = model.release_date
  return normalized
}

async function loadCatalog(
  fetcher: typeof fetch,
  options: { useCache: boolean }
): Promise<ModelsDevCatalog | null> {
  if (options.useCache) {
    const cached = await readCacheJSON<ModelsDevCatalog>(
      MODELS_DEV_CACHE_KEY,
      MODELS_DEV_CACHE_TTL_MS
    )
    if (cached) return cached
  }
  try {
    const response = await fetcher(MODELS_DEV_URL)
    if (!response.ok) throw new Error(`models.dev catalog request failed: ${response.status}`)
    const catalog = (await response.json()) as ModelsDevCatalog
    if (options.useCache) await writeCacheJSON(MODELS_DEV_CACHE_KEY, catalog)
    return catalog
  } catch {
    return null
  }
}

async function resolvedCatalog(fetcher?: typeof fetch): Promise<ModelsDevCatalog | null> {
  const nativeFetch = typeof globalThis.fetch === 'function' ? globalThis.fetch : undefined
  const resolvedFetcher = fetcher ?? nativeFetch
  if (!resolvedFetcher) return null
  const useCache = resolvedFetcher === nativeFetch
  if (!useCache) return loadCatalog(resolvedFetcher, { useCache: false })
  const pending = (catalogPromise ??= loadCatalog(resolvedFetcher, { useCache: true }))
  try {
    const catalog = await pending
    if (!catalog && catalogPromise === pending) catalogPromise = null
    return catalog
  } catch {
    if (catalogPromise === pending) catalogPromise = null
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

function curatedProviderModels(providerID: AIProviderID): ModelOption[] {
  return AI_PROVIDERS.find((provider) => provider.id === providerID)?.models ?? []
}

function supportsDesignWork(model: ModelsDevModel): boolean {
  if (model.tool_call !== true || model.status === 'deprecated') return false
  const outputModalities = model.modalities?.output
  return Array.isArray(outputModalities) && outputModalities.includes('text')
}

function mergeCuratedModels(curated: ModelOption[], catalog: ModelOption[]): ModelOption[] {
  const catalogById = new Map(catalog.map((model) => [model.id, model]))
  const recommended = curated.map((model) => ({
    ...catalogById.get(model.id),
    ...model,
    capabilities: catalogById.get(model.id)?.capabilities ?? model.capabilities,
    recommendedMaxOutputTokens:
      catalogById.get(model.id)?.recommendedMaxOutputTokens ?? model.recommendedMaxOutputTokens
  }))
  const curatedIds = new Set(curated.map((model) => model.id))
  const remaining = catalog
    .filter((model) => !curatedIds.has(model.id))
    .sort((left, right) => (right.releaseDate ?? '').localeCompare(left.releaseDate ?? ''))
  return [...recommended, ...remaining]
}

export async function listCatalogModels(
  providerID: AIProviderID,
  fetcher?: typeof fetch
): Promise<ModelOption[]> {
  const curated = curatedProviderModels(providerID)
  const providerKeys = PROVIDER_KEYS[providerID]
  if (!providerKeys?.length) return curated
  const catalog = await resolvedCatalog(fetcher)
  if (!catalog) return curated

  const models = providerKeys.flatMap((providerKey) =>
    Object.entries(catalog[providerKey]?.models ?? {})
      .filter(([, model]) => supportsDesignWork(model))
      .map(([id, model]) => normalizeModel(id, model))
  )
  return models.length ? mergeCuratedModels(curated, models) : curated
}

export async function resolveModelsDevModel(
  providerID: AIProviderID,
  modelID: string,
  fetcher?: typeof fetch
): Promise<ModelOption | null> {
  const providerKeys = PROVIDER_KEYS[providerID]
  if (!providerKeys?.length || !modelID) return null
  const catalog = await resolvedCatalog(fetcher)
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
