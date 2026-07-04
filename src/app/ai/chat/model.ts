import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'

import type { AIProviderID } from '@open-pencil/core/constants'

import { isTauri } from '@/app/tauri/env'
import { tauriFetch } from '@/app/tauri/http'

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
  if (config.providerID === 'requesty') return customModelID || config.modelID
  if (config.providerID === 'openai-compatible' || config.providerID === 'anthropic-compatible') {
    return customModelID
  }
  return config.modelID
}

function desktopFetch(): typeof fetch | undefined {
  return isTauri() ? tauriFetch : undefined
}

export function createLanguageModel(config: ModelConfig): LanguageModel {
  const effectiveModelID = resolveLanguageModelID(config)
  const fetch = desktopFetch()

  switch (config.providerID) {
    case 'openrouter': {
      const openrouter = createOpenRouter({
        apiKey: config.apiKey,
        fetch,
        headers: {
          'X-OpenRouter-Title': 'OpenPencil',
          'HTTP-Referer': 'https://github.com/open-pencil/open-pencil'
        }
      })
      return openrouter(effectiveModelID)
    }
    case 'requesty': {
      const requesty = createOpenAI({
        apiKey: config.apiKey,
        baseURL: 'https://router.requesty.ai/v1',
        fetch,
        headers: {
          'X-Title': 'OpenPencil',
          'HTTP-Referer': 'https://github.com/open-pencil/open-pencil'
        }
      })
      return requesty.chat(effectiveModelID)
    }
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey: config.apiKey, fetch })
      return anthropic(effectiveModelID)
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey: config.apiKey, fetch })
      return openai(effectiveModelID)
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey: config.apiKey, fetch })
      return google(effectiveModelID)
    }
    case 'deepseek': {
      const deepseek = createDeepSeek({ apiKey: config.apiKey, fetch })
      return deepseek(effectiveModelID)
    }
    case 'zai': {
      const zai = createAnthropic({
        apiKey: config.apiKey,
        baseURL: 'https://api.z.ai/api/anthropic',
        fetch
      })
      return zai(effectiveModelID)
    }
    case 'minimax': {
      const minimax = createOpenAI({
        apiKey: config.apiKey,
        baseURL: 'https://api.minimax.io/v1',
        fetch
      })
      return minimax.chat(effectiveModelID)
    }
    case 'openai-compatible': {
      const custom = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.customBaseURL,
        fetch
      })
      return config.customAPIType === 'responses'
        ? custom.responses(effectiveModelID)
        : custom.chat(effectiveModelID)
    }
    case 'anthropic-compatible': {
      const custom = createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.customBaseURL,
        fetch
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
