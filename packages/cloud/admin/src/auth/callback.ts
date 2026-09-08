import type { LocationQuery } from 'vue-router'

export type OAuthCallbackState =
  | { kind: 'none' }
  | { kind: 'cancelled' }
  | { kind: 'approval-required' }
  | { kind: 'enrollment-closed' }
  | { kind: 'provider-error' }

const CALLBACK_ERROR_KEYS = ['error', 'error_description', 'error_code'] as const

function firstQueryValue(value: LocationQuery[string] | undefined): string {
  return typeof value === 'string' ? value : ''
}

export function parseOAuthCallback(query: LocationQuery): OAuthCallbackState {
  const error = firstQueryValue(query.error)
  const description = firstQueryValue(query.error_description)
  const code = firstQueryValue(query.error_code)
  const values = new Set([error, description, code].filter(Boolean))
  if (values.size === 0) return { kind: 'none' }
  if (values.has('access_denied')) return { kind: 'cancelled' }
  if (values.has('enrollment_approval_required')) return { kind: 'approval-required' }
  if (values.has('enrollment_closed')) return { kind: 'enrollment-closed' }
  return { kind: 'provider-error' }
}

export function withoutOAuthCallback(query: LocationQuery): LocationQuery {
  return Object.fromEntries(
    Object.entries(query).filter(
      ([key]) => !CALLBACK_ERROR_KEYS.includes(key as (typeof CALLBACK_ERROR_KEYS)[number])
    )
  )
}
