import { generateText } from 'ai'

import { createLanguageModel, resolveLanguageModelID, type ModelConfig } from '@/app/ai/chat/model'
import { isTauri } from '@/app/tauri/env'

const PROVIDER_CONNECTION_TEST_TIMEOUT_MS = 15_000

export type ProviderConnectionTestResult =
  | { ok: true }
  | { ok: false; reason: ProviderConnectionTestFailureReason }

export type ProviderConnectionTestFailureReason =
  | 'missing-api-key'
  | 'missing-base-url'
  | 'missing-model'
  | 'invalid-base-url'
  | 'auth'
  | 'model-not-found'
  | 'api-type'
  | 'browser-network'
  | 'network'
  | 'unknown'

function isCompatibleProvider(providerID: ModelConfig['providerID']): boolean {
  return providerID === 'openai-compatible' || providerID === 'anthropic-compatible'
}

function validateConfig(config: ModelConfig): ProviderConnectionTestFailureReason | null {
  if (!config.apiKey.trim()) return 'missing-api-key'
  if (isCompatibleProvider(config.providerID)) {
    if (!config.customBaseURL.trim()) return 'missing-base-url'
    try {
      const url = new URL(config.customBaseURL.trim())
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'invalid-base-url'
    } catch {
      return 'invalid-base-url'
    }
  }
  if (!resolveLanguageModelID(config).trim()) return 'missing-model'
  return null
}

type ProviderErrorShape = {
  statusCode?: unknown
  status?: unknown
  responseStatusCode?: unknown
  responseStatus?: unknown
  code?: unknown
  response?: { status?: unknown }
}

function isProviderErrorShape(error: unknown): error is ProviderErrorShape {
  return typeof error === 'object' && error !== null
}

function statusNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return null
}

function errorStatus(error: unknown): number | null {
  if (!isProviderErrorShape(error)) return null
  return (
    statusNumber(error.statusCode) ??
    statusNumber(error.status) ??
    statusNumber(error.responseStatusCode) ??
    statusNumber(error.responseStatus) ??
    statusNumber(error.code) ??
    statusNumber(error.response?.status)
  )
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return `${error.name}: ${error.message}`
  }
  return String(error)
}

function classifyStatus(
  status: number | null,
  text: string
): ProviderConnectionTestFailureReason | null {
  if (status === 401 || status === 403) return 'auth'
  if (status === 404) return 'model-not-found'
  if (status !== 400 && status !== 405) return null
  if (text.includes('model')) return 'model-not-found'
  if (text.includes('responses') || text.includes('chat') || text.includes('endpoint')) {
    return 'api-type'
  }
  return null
}

function classifyMessage(text: string): ProviderConnectionTestFailureReason | null {
  if (
    text.includes('api key') ||
    text.includes('authentication') ||
    text.includes('unauthorized')
  ) {
    return 'auth'
  }
  if (text.includes('model') && (text.includes('not found') || text.includes('does not exist'))) {
    return 'model-not-found'
  }
  if (
    text.includes('failed to fetch') ||
    text.includes('networkerror') ||
    text.includes('load failed')
  ) {
    return isTauri() ? 'network' : 'browser-network'
  }
  if (text.includes('connection') || text.includes('network') || text.includes('timeout')) {
    return 'network'
  }
  return null
}

function classifyError(error: unknown): ProviderConnectionTestFailureReason {
  const text = errorText(error).toLowerCase()
  return classifyStatus(errorStatus(error), text) ?? classifyMessage(text) ?? 'unknown'
}

export async function testProviderConnection(
  config: ModelConfig
): Promise<ProviderConnectionTestResult> {
  const invalidReason = validateConfig(config)
  if (invalidReason) return { ok: false, reason: invalidReason }

  try {
    await generateText({
      model: createLanguageModel(config, { requestTimeoutMs: PROVIDER_CONNECTION_TEST_TIMEOUT_MS }),
      prompt: 'Reply with OK.',
      maxOutputTokens: 1,
      abortSignal: AbortSignal.timeout(PROVIDER_CONNECTION_TEST_TIMEOUT_MS)
    })
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: classifyError(error) }
  }
}
