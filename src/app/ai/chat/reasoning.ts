import type { LanguageModelCallOptions } from 'ai'

import type { AIProviderID } from '@open-pencil/core/constants'

import type { ThinkingLevel } from '@/app/ai/models/types'

type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue }
export type AIProviderOptions = Record<string, { [key: string]: JSONValue }>

export type ReasoningCallSettings = {
  reasoning?: LanguageModelCallOptions['reasoning']
  providerOptions?: AIProviderOptions
}

/**
 * AI SDK providers map the standard `reasoning` level to their own thinking options.
 * OpenRouter's provider ignores it, so it receives the equivalent provider option.
 */
export function reasoningCallSettings(
  providerID: AIProviderID,
  level: ThinkingLevel
): ReasoningCallSettings {
  if (level === 'default') return {}
  const reasoning = level === 'off' ? 'none' : level
  if (providerID === 'openrouter') {
    return { providerOptions: { openrouter: { reasoning: { effort: reasoning } } } }
  }
  return { reasoning }
}
