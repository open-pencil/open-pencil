import type { LanguageModel } from 'ai'

import type { ModelConfig, ModelProviderRuntime } from '@/app/ai/providers/types'
import type { FetchFunction } from '@/app/http/types'
import { isTauri } from '@/app/tauri/env'
import { tauriFetch } from '@/app/tauri/http'

export type { ModelConfig } from '@/app/ai/providers/types'

export function resolveLanguageModelID(
  config: Pick<ModelConfig, 'providerID' | 'modelID' | 'customModelID'>
): string {
  if (
    config.providerID === 'openrouter' ||
    config.providerID === 'openai-compatible' ||
    config.providerID === 'anthropic-compatible'
  ) {
    return config.customModelID.trim() || config.modelID
  }
  return config.modelID
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
