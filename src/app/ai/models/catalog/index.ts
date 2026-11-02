import { uniq } from 'es-toolkit/array'
import * as v from 'valibot'

import { AI_PROVIDERS } from '@open-pencil/core/constants'
import type { AIProviderID, ModelOption } from '@open-pencil/core/constants'

import { cachedRemoteJSON } from '@/app/cache/remote'

import { listChatGPTModels } from './chatgpt'

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

const modelsDevCatalogSchema = v.record(
  v.string(),
  v.object({
    models: v.optional(
      v.record(
        v.string(),
        v.looseObject({
          modalities: v.optional(v.looseObject({ output: v.optional(v.unknown()) })),
          limit: v.optional(v.looseObject({ output: v.optional(v.unknown()) }))
        })
      )
    )
  })
) satisfies v.GenericSchema<unknown, ModelsDevCatalog>

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

const modelsDevCatalog = cachedRemoteJSON({
  key: MODELS_DEV_CACHE_KEY,
  schema: modelsDevCatalogSchema,
  maxAgeMs: MODELS_DEV_CACHE_TTL_MS,
  load: async (fetcher) => {
    const response = await fetcher(MODELS_DEV_URL)
    if (!response.ok) throw new Error(`models.dev catalog request failed: ${response.status}`)
    // Validated like the cached copy, so a bad entry falls back instead of crashing the list.
    return v.parse(v.pipe(v.string(), v.parseJson(), modelsDevCatalogSchema), await response.text())
  }
})

function modelIDCandidates(providerKey: string, modelID: string): string[] {
  const unprefixed = modelID.startsWith(`${providerKey}/`)
    ? modelID.slice(providerKey.length + 1)
    : modelID
  return uniq([
    modelID,
    unprefixed,
    unprefixed.replace(/-\d{8}$/, ''),
    unprefixed.replace(/:[a-z0-9-]+$/, '')
  ])
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

/** The account's own list in its order; recommended models keep their names and tags. */
function withCuratedNames(curated: ModelOption[], listed: ModelOption[]): ModelOption[] {
  const curatedById = new Map(curated.map((model) => [model.id, model]))
  return listed.map((model) => {
    const known = curatedById.get(model.id)
    return known ? { ...model, name: known.name, tag: known.tag } : model
  })
}

export async function listCatalogModels(
  providerID: AIProviderID,
  fetcher?: typeof fetch
): Promise<ModelOption[]> {
  const curated = curatedProviderModels(providerID)
  if (providerID === 'chatgpt') {
    const listed = await listChatGPTModels()
    return listed ? withCuratedNames(curated, listed) : curated
  }
  const providerKeys = PROVIDER_KEYS[providerID]
  if (!providerKeys?.length) return curated
  const catalog = await modelsDevCatalog.get(fetcher)
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
  const catalog = await modelsDevCatalog.get(fetcher)
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
  modelsDevCatalog.reset()
}
