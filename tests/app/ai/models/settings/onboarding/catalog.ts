import { AI_PROVIDERS } from '@open-pencil/core/constants'

/** The catalog's default model, so onboarding tests follow catalog updates. */
export function defaultModel(providerID: string): string {
  return AI_PROVIDERS.find((provider) => provider.id === providerID)?.defaultModel ?? ''
}

/** The catalog model tagged as fast that can call tools. */
export function fastModel(providerID: string): string {
  const provider = AI_PROVIDERS.find((candidate) => candidate.id === providerID)
  return (
    provider?.models.find((model) => model.tag === 'Fast' && model.capabilities?.includes('tools'))
      ?.id ?? ''
  )
}
