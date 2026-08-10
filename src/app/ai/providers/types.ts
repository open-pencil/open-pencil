import type { LanguageModel } from 'ai'

import type { AIProviderID } from '@open-pencil/core/constants'

export type ModelConfig = {
  providerID: AIProviderID
  apiKey: string
  modelID: string
  customModelID: string
  customBaseURL: string
  customAPIType: 'completions' | 'responses' | 'transcription'
}

export type ModelProviderRuntime = {
  fetch?: typeof fetch
}

export interface ModelProviderAdapter {
  create(config: ModelConfig, runtime: ModelProviderRuntime): LanguageModel
}
