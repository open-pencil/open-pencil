import type { LanguageModel } from 'ai'

import type { AIProviderID } from '@open-pencil/core/constants'

import type { FetchFunction } from '@/app/http/types'

export type ModelConfig = {
  providerID: AIProviderID
  apiKey: string
  modelID: string
  customModelID: string
  customBaseURL: string
  customAPIType: 'completions' | 'responses'
}

export type ModelProviderRuntime = {
  fetch?: FetchFunction
}

export interface ModelProviderAdapter {
  create(config: ModelConfig, runtime: ModelProviderRuntime): LanguageModel
}
