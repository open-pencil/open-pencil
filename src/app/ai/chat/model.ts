import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'

import type { AIProviderID } from '@inkly/core/constants'

export type ModelConfig = {
  providerID: AIProviderID
  apiKey: string
  modelID: string
  customModelID: string
  customBaseURL: string
  customAPIType: 'completions' | 'responses'
}

export function resolveLanguageModelID(
  config: Pick<ModelConfig, 'providerID' | 'modelID' | 'customModelID'>
) {
  const customModelID = config.customModelID.trim()
  if (config.providerID === 'openrouter') return customModelID || config.modelID
  if (config.providerID === 'openai-compatible' || config.providerID === 'anthropic-compatible') {
    return customModelID
  }
  return config.modelID
}

export function createLanguageModel(config: ModelConfig): LanguageModel {
  const effectiveModelID = resolveLanguageModelID(config)

  switch (config.providerID) {
    case 'openrouter': {
      const openrouter = createOpenRouter({
        apiKey: config.apiKey,
        headers: {
          'X-OpenRouter-Title': 'Inkly',
          'HTTP-Referer': 'https://github.com/cardene777/open-pencil'
        }
      })
      return openrouter(effectiveModelID)
    }
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey: config.apiKey })
      return anthropic(effectiveModelID)
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey: config.apiKey })
      return openai(effectiveModelID)
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey: config.apiKey })
      return google(effectiveModelID)
    }
    case 'deepseek': {
      const deepseek = createDeepSeek({ apiKey: config.apiKey })
      return deepseek(effectiveModelID)
    }
    case 'zai': {
      const zai = createAnthropic({
        apiKey: config.apiKey,
        baseURL: 'https://api.z.ai/api/anthropic'
      })
      return zai(effectiveModelID)
    }
    case 'minimax': {
      const minimax = createOpenAI({
        apiKey: config.apiKey,
        baseURL: 'https://api.minimax.io/v1'
      })
      return minimax.chat(effectiveModelID)
    }
    case 'openai-compatible': {
      const custom = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.customBaseURL
      })
      return config.customAPIType === 'responses'
        ? custom.responses(effectiveModelID)
        : custom.chat(effectiveModelID)
    }
    case 'anthropic-compatible': {
      const custom = createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.customBaseURL
      })
      return custom(effectiveModelID)
    }
    default: {
      if (config.providerID.startsWith('acp:')) {
        throw new Error('ACP providers do not use direct API models')
      }
      throw new Error(`Unknown provider: ${config.providerID}`)
    }
  }
}
