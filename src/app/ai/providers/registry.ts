import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

import type { AIProviderID } from '@open-pencil/core/constants'

import { chatGPTAdapter } from '@/app/ai/providers/chatgpt/adapter'
import {
  createAnthropicCompatibleAdapter,
  createOpenAICompatibleAdapter
} from '@/app/ai/providers/compatible'
import type { ModelProviderAdapter } from '@/app/ai/providers/types'

type DirectProviderID = Exclude<AIProviderID, `acp:${string}` | `harness:${string}`>

const MODEL_PROVIDER_ADAPTERS = {
  openrouter: {
    create(config, runtime) {
      const provider = createOpenRouter({
        apiKey: config.apiKey,
        fetch: runtime.fetch,
        headers: {
          'X-OpenRouter-Title': 'OpenPencil',
          'HTTP-Referer': 'https://github.com/open-pencil/open-pencil'
        }
      })
      return provider(config.customModelID.trim() || config.modelID)
    }
  },
  // WebP: https://platform.claude.com/docs/en/build-with-claude/vision#supported-formats
  anthropic: createAnthropicCompatibleAdapter({ webpImages: true }),
  // WebP: https://developers.openai.com/api/docs/guides/images-vision
  openai: createOpenAICompatibleAdapter({ webpImages: true }),
  chatgpt: chatGPTAdapter,
  google: {
    create(config, runtime) {
      return createGoogleGenerativeAI({ apiKey: config.apiKey, fetch: runtime.fetch })(
        config.modelID
      )
    },
    // https://ai.google.dev/gemini-api/docs/image-understanding
    webpImages: true
  },
  deepseek: {
    create(config, runtime) {
      return createDeepSeek({ apiKey: config.apiKey, fetch: runtime.fetch })(config.modelID)
    },
    // https://api-docs.deepseek.com/guides/vision
    webpImages: true
  },
  zai: createAnthropicCompatibleAdapter({ baseURL: 'https://api.z.ai/api/anthropic' }),
  minimax: createOpenAICompatibleAdapter({ baseURL: 'https://api.minimax.io/v1', mode: 'chat' }),
  'openai-compatible': createOpenAICompatibleAdapter({
    baseURL: (config) => config.customBaseURL,
    mode: 'configurable'
  }),
  'anthropic-compatible': createAnthropicCompatibleAdapter({
    baseURL: (config) => config.customBaseURL
  }),
  // The base URL and the token-carrying fetch come from Cloud's AI service, not from settings.
  openpencil: createOpenAICompatibleAdapter({
    baseURL: (config) => config.customBaseURL,
    mode: 'chat'
  })
} satisfies Record<DirectProviderID, ModelProviderAdapter>

function isDirectProviderID(providerID: AIProviderID): providerID is DirectProviderID {
  return !providerID.startsWith('acp:') && providerID !== 'harness:pi'
}

/** Whether tool images reach the provider's models as WebP; see `ModelProviderAdapter.webpImages`. */
export function providerTakesWebPImages(providerID: AIProviderID): boolean {
  return isDirectProviderID(providerID) && modelProviderAdapter(providerID).webpImages === true
}

export function modelProviderAdapter(providerID: AIProviderID): ModelProviderAdapter {
  if (!isDirectProviderID(providerID)) {
    throw new Error('ACP providers and Harness agents do not use direct API models')
  }
  return MODEL_PROVIDER_ADAPTERS[providerID]
}
