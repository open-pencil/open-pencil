import type { AIProviderID } from '@open-pencil/core/constants'

import type { AIProviderOptions } from '@/app/ai/models/reasoning/settings'

const EPHEMERAL = { cacheControl: { type: 'ephemeral' } }

/**
 * Request-level prompt caching, for providers that cache only when asked. Each AI SDK provider
 * reads it from its own namespace: OpenRouter sends `openrouter.cacheControl` as the top-level
 * `cache_control` that its Anthropic routes honour, and ignores the `anthropic` namespace there.
 * Providers that cache automatically, such as OpenAI, Google, DeepSeek, and Z.AI, get nothing.
 */
export function promptCachingOptions(
  providerID: AIProviderID,
  modelID: string
): AIProviderOptions | undefined {
  if (providerID === 'anthropic' || providerID === 'anthropic-compatible') {
    return { anthropic: EPHEMERAL }
  }
  if (providerID === 'openrouter' && modelID.startsWith('anthropic/')) {
    return { openrouter: EPHEMERAL }
  }
  return undefined
}
