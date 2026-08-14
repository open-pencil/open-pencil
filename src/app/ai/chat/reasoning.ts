import type { AIProviderID } from '@open-pencil/core/constants'

type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue }
export type AIProviderOptions = Record<string, { [key: string]: JSONValue }>

export function buildReasoningProviderOptions(
  providerID: AIProviderID,
  reasoningEffort: string
): AIProviderOptions | undefined {
  if (!reasoningEffort) return undefined
  if (providerID === 'openrouter') {
    return { openrouter: { reasoning: { effort: reasoningEffort } } }
  }
  if (providerID === 'openai' || providerID === 'openai-compatible') {
    return { openai: { reasoningEffort } }
  }
  return undefined
}
