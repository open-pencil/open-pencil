import { APICallError } from 'ai'

export type AIChatFailureReason =
  | 'authentication'
  | 'forbidden'
  | 'insufficient-credit'
  | 'model-not-found'
  | 'network'
  | 'output-limit'
  | 'rate-limit'
  | 'request-failed'

export type AIChatFailure = {
  reason: AIChatFailureReason
  detail?: string
  statusCode?: number
  retryable?: boolean
}

export type ProviderErrorShape = {
  statusCode?: unknown
  status?: unknown
  responseStatusCode?: unknown
  responseStatus?: unknown
  code?: unknown
  response?: { status?: unknown }
}

function statusNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return null
}

export function providerErrorStatus(error: unknown): number | null {
  if (APICallError.isInstance(error)) return error.statusCode ?? null
  if (typeof error !== 'object' || error === null) return null
  const value = error as ProviderErrorShape
  return (
    statusNumber(value.statusCode) ??
    statusNumber(value.status) ??
    statusNumber(value.responseStatusCode) ??
    statusNumber(value.responseStatus) ??
    statusNumber(value.code) ??
    statusNumber(value.response?.status)
  )
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function normalizedErrorText(error: unknown): string {
  return errorText(error).toLowerCase()
}

export function isInsufficientCreditError(error: unknown): boolean {
  if (providerErrorStatus(error) === 402) return true
  const text = normalizedErrorText(error)
  return [
    'insufficient credit',
    'insufficient balance',
    'insufficient quota',
    'credit balance',
    'payment required',
    'quota exceeded',
    'billing quota',
    'top up',
    'top-up'
  ].some((phrase) => text.includes(phrase))
}

function statusFailureReason(status: number | null): AIChatFailureReason | null {
  if (status === 401) return 'authentication'
  if (status === 402) return 'insufficient-credit'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'model-not-found'
  if (status === 408) return 'network'
  if (status === 429) return 'rate-limit'
  return null
}

function failureReason(error: unknown): AIChatFailureReason {
  const statusReason = statusFailureReason(providerErrorStatus(error))
  if (statusReason) return statusReason
  if (isInsufficientCreditError(error)) return 'insufficient-credit'
  const text = normalizedErrorText(error)
  if (
    (text.includes('expired') || text.includes('invalid') || text.includes('authentication')) &&
    (text.includes('key') || text.includes('token') || text.includes('credential'))
  ) {
    return 'authentication'
  }
  if (text.includes('rate limit') || text.includes('too many requests')) return 'rate-limit'
  if (text.includes('model not found') || text.includes('unknown model')) return 'model-not-found'
  if (
    text.includes('failed to fetch') ||
    text.includes('network') ||
    text.includes('cors') ||
    text.includes('connection')
  ) {
    return 'network'
  }
  return 'request-failed'
}

export function classifyAIChatFinish(finishReason?: string): AIChatFailure | null {
  return finishReason === 'length' ? { reason: 'output-limit' } : null
}

export function classifyAIChatError(error: unknown): AIChatFailure {
  return {
    reason: failureReason(error),
    detail: errorText(error),
    statusCode: providerErrorStatus(error) ?? undefined,
    retryable: APICallError.isInstance(error) ? error.isRetryable : undefined
  }
}
