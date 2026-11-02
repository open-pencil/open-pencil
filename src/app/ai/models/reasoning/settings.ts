import type { LanguageModelCallOptions } from 'ai'

import { REASONING_EFFORTS } from '@open-pencil/core/constants'
import type { AIProviderID, ReasoningEffort } from '@open-pencil/core/constants'

import type { DirectAIModelRuntime } from '@/app/ai/models/runtime'
import type { ThinkingLevel } from '@/app/ai/models/types'

type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue }
export type AIProviderOptions = Record<string, { [key: string]: JSONValue }>

export type ReasoningCallSettings = {
  reasoning?: LanguageModelCallOptions['reasoning']
  providerOptions?: AIProviderOptions
}

function raisedLevel(level: ThinkingLevel, minEffort: ReasoningEffort | undefined) {
  if (!minEffort || level === 'default') return level
  if (level === 'off') return minEffort
  return REASONING_EFFORTS.indexOf(level) < REASONING_EFFORTS.indexOf(minEffort) ? minEffort : level
}

/**
 * AI SDK providers map the standard `reasoning` level to their own thinking options.
 * OpenRouter's provider ignores it, so it receives the equivalent provider option.
 * Models that always reason raise lower levels to the lowest effort they accept.
 */
export function reasoningCallSettings(
  providerID: AIProviderID,
  level: ThinkingLevel,
  minEffort?: ReasoningEffort
): ReasoningCallSettings {
  const effective = raisedLevel(level, minEffort)
  if (effective === 'default') return {}
  const reasoning = effective === 'off' ? 'none' : effective
  if (providerID === 'openrouter') {
    return { providerOptions: { openrouter: { reasoning: { effort: reasoning } } } }
  }
  return { reasoning }
}

/** Reasoning settings for a runtime's own thinking level. */
export function runtimeReasoningSettings(
  runtime: Pick<DirectAIModelRuntime, 'role' | 'minReasoningEffort'>
): ReasoningCallSettings {
  return reasoningCallSettings(
    runtime.role.connection.providerID,
    runtime.role.profile.thinkingLevel,
    runtime.minReasoningEffort
  )
}
