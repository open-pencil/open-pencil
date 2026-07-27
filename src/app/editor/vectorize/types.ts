export const VECTORIZE_PROVIDER_IDS = ['recraft', 'fal'] as const

export type VectorizeProviderID = (typeof VECTORIZE_PROVIDER_IDS)[number]

export type VectorizeProviderDefinition = {
  id: VectorizeProviderID
  name: string
  keyURL: string
  keyPlaceholder: string
}

export type VectorizeProvider = VectorizeProviderDefinition & {
  vectorize(pngBytes: Uint8Array, apiKey: string): Promise<string>
}

export class VectorizeAuthError extends Error {
  constructor(providerName: string) {
    super(`${providerName} API key was rejected`)
    this.name = 'VectorizeAuthError'
  }
}

export class VectorizeTimeoutError extends Error {
  constructor() {
    super('Vectorization request timed out')
    this.name = 'VectorizeTimeoutError'
  }
}
