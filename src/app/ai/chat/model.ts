import type { LanguageModel } from 'ai'

import { modelProviderAdapter } from '@/app/ai/providers/registry'
import type { ModelConfig } from '@/app/ai/providers/types'
import { isTauri } from '@/app/tauri/env'
import { createTauriFetch, tauriFetch } from '@/app/tauri/http'

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

interface CreateLanguageModelOptions {
  requestTimeoutMs?: number
}

function desktopFetch(timeoutMs?: number): typeof fetch | undefined {
  if (!isTauri()) return undefined
  if (timeoutMs !== undefined) return createTauriFetch({ timeoutMs })
  return tauriFetch
}

export function createLanguageModel(
  config: ModelConfig,
  options: CreateLanguageModelOptions = {}
): LanguageModel {
  return modelProviderAdapter(config.providerID).create(config, {
    fetch: desktopFetch(options.requestTimeoutMs)
  })
}
