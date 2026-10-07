import * as v from 'valibot'

/** Describes the key it is called with, without using credits. */
export const OPENROUTER_KEY_INFO_URL = 'https://openrouter.ai/api/v1/key'

export interface OpenRouterKeyInfo {
  label: string
  /** The account has never bought credits, so only free models will answer. */
  freeTier: boolean
}

export class OpenRouterKeyError extends Error {
  constructor(readonly status: number) {
    super(`OpenRouter rejected the key with status ${status}`)
    this.name = 'OpenRouterKeyError'
  }
}

/** Only the fields setup shows; anything missing reads as an unnamed key on the free tier. */
const keyInfoSchema = v.object({
  data: v.object({
    label: v.fallback(v.string(), ''),
    is_free_tier: v.fallback(v.boolean(), false)
  })
})

/** Checks that OpenRouter accepts a key and reports what it belongs to. */
export async function fetchOpenRouterKeyInfo(
  key: string,
  fetchImpl: typeof fetch = fetch
): Promise<OpenRouterKeyInfo> {
  const response = await fetchImpl(OPENROUTER_KEY_INFO_URL, {
    headers: { authorization: `Bearer ${key}` }
  })
  if (!response.ok) throw new OpenRouterKeyError(response.status)
  const parsed = v.safeParse(keyInfoSchema, await response.json())
  const data = parsed.success ? parsed.output.data : { label: '', is_free_tier: false }
  return { label: data.label, freeTier: data.is_free_tier }
}
