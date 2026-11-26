import { AI_PROVIDERS, type ProviderRoleModels } from '@open-pencil/core/constants'

/** The catalog's default model, so onboarding tests follow catalog updates. */
export function defaultModel(providerID: string): string {
  return AI_PROVIDERS.find((provider) => provider.id === providerID)?.defaultModel ?? ''
}

/** What the provider recommends for each role, so onboarding tests follow catalog updates. */
export function recommendedRoles(providerID: string): ProviderRoleModels {
  const roles = AI_PROVIDERS.find((provider) => provider.id === providerID)?.roles
  if (!roles) throw new Error(`${providerID} recommends no models`)
  return roles
}
