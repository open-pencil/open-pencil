import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

import { IS_TAURI } from '@open-pencil/core/constants'

import type { ModelConfig, ModelProviderAdapter } from '@/app/ai/providers/types'

// Anthropic omits CORS headers unless the caller opts in, so browser requests fail with an
// opaque "failed to fetch". The desktop build goes through tauriFetch and is not subject to CORS.
const BROWSER_ACCESS_HEADERS = { 'anthropic-dangerous-direct-browser-access': 'true' }

export type CompatibleEndpoint = string | ((config: ModelConfig) => string)

type OpenAICompatibleOptions = {
  baseURL?: CompatibleEndpoint
  mode?: 'default' | 'chat' | 'configurable'
}

type AnthropicCompatibleOptions = {
  baseURL?: CompatibleEndpoint
}

function resolveEndpoint(endpoint: CompatibleEndpoint | undefined, config: ModelConfig) {
  return typeof endpoint === 'function' ? endpoint(config) : endpoint
}

export function createOpenAICompatibleAdapter(
  options: OpenAICompatibleOptions = {}
): ModelProviderAdapter {
  return {
    create(config, runtime) {
      const provider = createOpenAI({
        apiKey: config.apiKey,
        baseURL: resolveEndpoint(options.baseURL, config),
        fetch: runtime.fetch
      })
      const modelID = config.customModelID.trim() || config.modelID
      if (options.mode === 'chat') return provider.chat(modelID)
      if (options.mode === 'configurable') {
        return config.customAPIType === 'responses'
          ? provider.responses(modelID)
          : provider.chat(modelID)
      }
      return provider(modelID)
    }
  }
}

export function createAnthropicCompatibleAdapter(
  options: AnthropicCompatibleOptions = {}
): ModelProviderAdapter {
  return {
    create(config, runtime) {
      const provider = createAnthropic({
        apiKey: config.apiKey,
        baseURL: resolveEndpoint(options.baseURL, config),
        fetch: runtime.fetch,
        headers: IS_TAURI ? undefined : BROWSER_ACCESS_HEADERS
      })
      return provider(config.customModelID.trim() || config.modelID)
    }
  }
}
