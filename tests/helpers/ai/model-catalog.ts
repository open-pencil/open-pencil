import { AI_PROVIDERS } from '@open-pencil/core/constants'

/** The catalog's default model, so onboarding tests follow catalog updates. */
export function defaultModel(providerID: string): string {
  return AI_PROVIDERS.find((provider) => provider.id === providerID)?.defaultModel ?? ''
}

/** Whether the catalog offers `modelID` as a fast model that can call tools. */
export function isFastToolModel(providerID: string, modelID: string): boolean {
  const model = AI_PROVIDERS.find((provider) => provider.id === providerID)?.models.find(
    (candidate) => candidate.id === modelID
  )
  return model?.tag === 'Fast' && model.capabilities?.includes('tools') === true
}
