import type { AIModelSettings } from '@/app/ai/models/types'

/**
 * A fresh install's model settings: the one Design model on an OpenAI-compatible server with no
 * address, which nothing can have used yet.
 */
export function freshInstallModelSettings(): AIModelSettings {
  return {
    version: 1,
    connections: [
      {
        id: 'connection-default',
        providerID: 'openai-compatible',
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: 'default'
      }
    ],
    models: [
      {
        id: 'model-default',
        name: 'Design model',
        connectionId: 'connection-default',
        modelID: '',
        customModelID: '',
        maxOutputTokens: 16_384,
        thinkingLevel: 'default',
        capabilities: ['tools']
      }
    ],
    assignments: { design: 'model-default', review: 'design', fast: 'design', vision: null }
  }
}
