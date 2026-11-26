import type { LanguageModel } from 'ai'

import { AI_PROVIDERS } from '@open-pencil/core/constants'

import type { ModelConfig, ModelProviderRuntime } from '@/app/ai/providers/types'
import type { FetchFunction } from '@/app/http/types'
import { isTauri } from '@/app/tauri/env'
import { tauriFetch } from '@/app/tauri/http'

export type { ModelConfig } from '@/app/ai/providers/types'

/**
 * The model a profile names: the ID typed in when there is one, else the one picked from a list.
 * Empty for an agent's profile that leaves the choice to the agent.
 */
export function profileModelID(profile: Pick<ModelConfig, 'modelID' | 'customModelID'>): string {
  return profile.customModelID.trim() || profile.modelID.trim()
}

/** The model a provider is asked for: a typed-in ID only where the provider takes one. */
export function resolveLanguageModelID(
  config: Pick<ModelConfig, 'providerID' | 'modelID' | 'customModelID'>
): string {
  const provider = AI_PROVIDERS.find((definition) => definition.id === config.providerID)
  return provider?.supportsCustomModel ? profileModelID(config) : config.modelID
}

function desktopFetch(): FetchFunction | undefined {
  return isTauri() ? tauriFetch : undefined
}

/**
 * `runtime.credentials` is the connection's store, for providers whose sign-in refreshes; a
 * `runtime.fetch`, such as Cloud's AI service's, replaces the desktop fetch. The provider SDKs
 * load with the first request, not with the editor.
 */
export async function createLanguageModel(
  config: ModelConfig,
  runtime: ModelProviderRuntime = {}
): Promise<LanguageModel> {
  const { modelProviderAdapter } = await import('@/app/ai/providers/registry')
  return modelProviderAdapter(config.providerID).create(config, {
    ...runtime,
    fetch: runtime.fetch ?? desktopFetch()
  })
}
