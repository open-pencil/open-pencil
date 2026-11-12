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

/** The stored credential of the connection a model belongs to. */
export type ModelCredentialStore = {
  load: () => Promise<string | null>
  save: (value: string) => Promise<void>
}

export type ModelProviderRuntime = {
  fetch?: FetchFunction
  /** Lets a provider whose sign-in refreshes keep the new credential. */
  credentials?: ModelCredentialStore
}

export interface ModelProviderAdapter {
  create(config: ModelConfig, runtime: ModelProviderRuntime): LanguageModel
}
