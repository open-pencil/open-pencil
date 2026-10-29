import { generateText } from 'ai'

import { AI_PROVIDERS } from '@open-pencil/core/constants'

import { isInsufficientCreditError, providerErrorStatus } from '@/app/ai/chat/failure'
import {
  createLanguageModel,
  resolveLanguageModelID,
  type ModelConfig
} from '@/app/ai/models/language-model'
import { cloudCreditRefusal } from '@/app/ai/providers/openpencil/failure'
import { OPENPENCIL_AI_PROVIDER } from '@/app/ai/providers/openpencil/provider'
import type { ModelProviderRuntime } from '@/app/ai/providers/types'
import { isTauri } from '@/app/tauri/env'

export type ProviderConnectionTestResult =
  | { ok: true }
  | { ok: false; reason: ProviderConnectionTestFailureReason }

export type ProviderConnectionTestFailureReason =
  | 'missing-api-key'
  | 'missing-sign-in'
  | 'missing-base-url'
  | 'missing-model'
  | 'invalid-base-url'
  | 'auth'
  | 'sign-in-expired'
  | 'plan-forbidden'
  | 'insufficient-credit'
  | 'model-not-found'
  | 'api-type'
  | 'browser-network'
  | 'network'
  | 'cloud-unavailable'
  | 'cloud-credits-exhausted'
  | 'unknown'

function isCompatibleProvider(providerID: ModelConfig['providerID']): boolean {
  return providerID === 'openai-compatible' || providerID === 'anthropic-compatible'
}

function isSignInOnly(providerID: ModelConfig['providerID']): boolean {
  return AI_PROVIDERS.some((provider) => provider.id === providerID && provider.signInOnly)
}

function validateConfig(config: ModelConfig): ProviderConnectionTestFailureReason | null {
  if (!config.apiKey.trim()) {
    return isSignInOnly(config.providerID) ? 'missing-sign-in' : 'missing-api-key'
  }
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

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
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

function classifyError(
  error: unknown,
  providerID: ModelConfig['providerID']
): ProviderConnectionTestFailureReason {
  // The workspace's plan holds Cloud's credits, not a provider account to top up.
  if (providerID === OPENPENCIL_AI_PROVIDER && cloudCreditRefusal(error)) {
    return 'cloud-credits-exhausted'
  }
  if (isInsufficientCreditError(error)) return 'insufficient-credit'
  const text = errorText(error).toLowerCase()
  return classifyStatus(providerErrorStatus(error), text) ?? classifyMessage(text) ?? 'unknown'
}

/**
 * Sends a one-token request. A test of a saved credential passes its store in `runtime`, so a
 * sign-in the request refreshes keeps the new tokens instead of leaving a spent refresh token
 * saved; a `runtime` with its own fetch, such as Cloud's AI service, is used instead of the default.
 */
export async function testProviderConnection(
  config: ModelConfig,
  runtime?: ModelProviderRuntime
): Promise<ProviderConnectionTestResult> {
  const invalidReason = validateConfig(config)
  if (invalidReason) return { ok: false, reason: invalidReason }

  try {
    await generateText({
      model: createLanguageModel(config, runtime),
      prompt: 'Reply with OK.',
      maxOutputTokens: 1,
      abortSignal: AbortSignal.timeout(15_000)
    })
    return { ok: true }
  } catch (error) {
    const reason = classifyError(error, config.providerID)
    if (reason !== 'auth' || !isSignInOnly(config.providerID)) return { ok: false, reason }
    // A provider signed in to has no key: a 403 is the plan, anything else the sign-in.
    const planForbidden = providerErrorStatus(error) === 403
    return { ok: false, reason: planForbidden ? 'plan-forbidden' : 'sign-in-expired' }
  }
}
