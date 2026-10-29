import { sortBy } from 'es-toolkit/array'
import * as v from 'valibot'

import { REASONING_EFFORTS } from '@open-pencil/core/constants'
import type { ModelOption, ReasoningEffort } from '@open-pencil/core/constants'

import { modelOptionsSchema } from '@/app/ai/models/catalog/schema'
import { readCacheJSON, writeCacheJSON } from '@/app/cache'
import { cachedRemoteJSON } from '@/app/cache/remote'
import type { FetchFunction } from '@/app/http/types'

import { CHATGPT_CODEX_BASE_URL } from './fetch'

/**
 * The backend lists only the models a Codex release supports, so the catalog asks as the
 * current release; an older version would hide newer models.
 */
const CODEX_RELEASE_URL = 'https://registry.npmjs.org/@openai/codex/latest'
const CODEX_RELEASE_CACHE_KEY = 'chatgpt/codex-release'
const CHATGPT_MODELS_CACHE_KEY = 'chatgpt/models'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 10_000

const codexRelease = cachedRemoteJSON({
  key: CODEX_RELEASE_CACHE_KEY,
  schema: v.string(),
  maxAgeMs: CACHE_TTL_MS,
  load: async (fetcher) => {
    const response = await fetcher(CODEX_RELEASE_URL, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (!response.ok) throw new Error(`Codex release request failed: ${response.status}`)
    const release = v.parse(
      v.pipe(v.string(), v.parseJson(), v.looseObject({ version: v.string() })),
      await response.text()
    )
    return release.version
  }
})

const chatGPTModelSchema = v.looseObject({
  slug: v.string(),
  display_name: v.optional(v.string()),
  visibility: v.optional(v.string()),
  priority: v.optional(v.number()),
  input_modalities: v.optional(v.array(v.string())),
  supported_reasoning_levels: v.optional(v.array(v.looseObject({ effort: v.string() })))
})
type ChatGPTModel = v.InferOutput<typeof chatGPTModelSchema>

// Entries are checked one by one, so one odd model keeps the rest.
const chatGPTModelsResponseSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ models: v.array(v.unknown()) })
)

function minReasoningEffort(model: ChatGPTModel): ReasoningEffort | undefined {
  const levels = model.supported_reasoning_levels?.map((level) => level.effort)
  if (!levels?.length) return undefined
  return REASONING_EFFORTS.find((effort) => levels.includes(effort))
}

/** Models the account may pick, best first; hidden ones serve Codex's own features. */
export function normalizeChatGPTModels(entries: unknown[]): ModelOption[] {
  const listed = entries.filter(
    (entry): entry is ChatGPTModel => v.is(chatGPTModelSchema, entry) && entry.visibility === 'list'
  )
  return sortBy(listed, [(model) => model.priority ?? Number.MAX_SAFE_INTEGER]).map((model) => {
    const option: ModelOption = {
      id: model.slug,
      name: model.display_name || model.slug,
      capabilities: model.input_modalities?.includes('image') ? ['tools', 'vision'] : ['tools']
    }
    const minEffort = minReasoningEffort(model)
    if (minEffort) option.minReasoningEffort = minEffort
    return option
  })
}

/** The last catalog fetched for any signed-in account, without asking the backend. */
export function cachedChatGPTModels(): Promise<ModelOption[] | null> {
  return readCacheJSON(CHATGPT_MODELS_CACHE_KEY, modelOptionsSchema).catch(() => null)
}

/** Fetches the account's models with a fetch signed by its sign-in, then caches the list. */
export async function fetchChatGPTModels(
  signedFetch: FetchFunction
): Promise<ModelOption[] | null> {
  const cached = await readCacheJSON(
    CHATGPT_MODELS_CACHE_KEY,
    modelOptionsSchema,
    CACHE_TTL_MS
  ).catch(() => null)
  if (cached) return cached
  const version = await codexRelease.get()
  if (!version) return null
  const url = new URL(`${CHATGPT_CODEX_BASE_URL}/models`)
  url.searchParams.set('client_version', version)
  const response = await signedFetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  if (!response.ok) return null
  const parsed = v.safeParse(chatGPTModelsResponseSchema, await response.text())
  const models = parsed.success ? normalizeChatGPTModels(parsed.output.models) : []
  if (!models.length) return null
  await writeCacheJSON(CHATGPT_MODELS_CACHE_KEY, models).catch(() => undefined)
  return models
}

export function resetChatGPTCatalogForTests(): void {
  codexRelease.reset()
}
