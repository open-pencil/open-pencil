import { ref } from 'vue'

import type { StorageProviderID } from '@/app/integrations/storage/types'
import type { OutboxJobType } from '@/app/storage/sync/types'

/**
 * Why a sync failed, in terms a user can act on.
 *
 * `unreachable` and `cors` both surface as `TypeError: Failed to fetch` in the
 * browser and are indistinguishable from the error alone — a cross-origin
 * rejection and a dead endpoint look identical. They are separated by whether
 * the browser itself reports connectivity, because the remedies share nothing:
 * one is a bucket CORS policy, the other is a network.
 */
export type SyncFailureCategory =
  | 'credentials'
  | 'permission'
  | 'not-found'
  | 'cors'
  | 'unreachable'
  | 'offline'
  | 'server'
  | 'unknown'

/**
 * An immutable record of one failure, captured at the moment it happened.
 *
 * Everything here is a snapshot on purpose. The previous implementation kept a
 * single truncated string and read provider context lazily when the modal
 * opened, so switching providers after a failure re-labelled it with the wrong
 * endpoint — and the chip's 120-character label was the only thing retained,
 * which discarded exactly the part a bug report needs.
 */
/**
 * Listing is not an outbox job, but it fails the same way and for the same
 * reasons — and a workspace that cannot list is not synced, whatever the queue
 * says. Without it here, an unreachable bucket with an empty outbox showed a
 * green chip beside a red error banner.
 */
export type SyncOperation = OutboxJobType | 'listDocuments'

export type SyncFailure = {
  operation: SyncOperation
  /** Provider the job was addressed to, captured at enqueue. */
  providerId: StorageProviderID
  /** Non-secret display context, e.g. endpoint and bucket. Never credentials. */
  providerContext: Record<string, string>
  documentIds: string[]
  documentName: string | null
  occurredAt: string
  attempts: number
  category: SyncFailureCategory
  /** Verbatim provider text. Guidance accompanies this; it never replaces it. */
  rawError: string
  /** HTTP status when the provider supplied one. */
  status: number | null
}

export const lastSyncFailure = ref<SyncFailure | null>(null)

export function recordSyncFailure(failure: SyncFailure): void {
  lastSyncFailure.value = failure
}

/** Clear on recovery so a stale failure cannot be reopened after a good sync. */
export function clearSyncFailure(): void {
  lastSyncFailure.value = null
}

export function httpStatusOf(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null
  const status = (error as { status: unknown }).status
  return typeof status === 'number' ? status : null
}

/** A fetch that never reached the server — CORS, DNS, offline, or a dead host. */
export function isFetchLevelFailure(error: unknown): boolean {
  return error instanceof TypeError && /fetch/i.test(error.message)
}

export function categorizeSyncFailure(error: unknown, browserOnline = true): SyncFailureCategory {
  const status = httpStatusOf(error)
  if (status === 401) return 'credentials'
  if (status === 403) return 'permission'
  if (status === 404) return 'not-found'
  if (status != null && status >= 500) return 'server'
  if (isFetchLevelFailure(error)) return browserOnline ? 'cors' : 'offline'
  if (!(error instanceof Error)) return 'unknown'
  const message = error.message.toLowerCase()
  if (message.includes('invalid access key') || message.includes('not configured')) {
    return 'credentials'
  }
  if (message.includes('access denied')) return 'permission'
  return 'unknown'
}

export function syncFailureErrorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Plain-text failure report for the clipboard.
 *
 * Everything here comes from the snapshot, so a bug report describes the
 * failure as it happened rather than as the app looks now. `providerContext`
 * is already classified non-secret at capture time (`nonSecretProviderContext`),
 * so nothing here can carry a credential.
 */
export function formatSyncFailureReport(failure: SyncFailure): string {
  return [
    'OpenPencil sync failure',
    `Operation: ${failure.operation}`,
    `Provider: ${failure.providerId}`,
    ...Object.entries(failure.providerContext).map(([field, value]) => `${field}: ${value}`),
    `Documents: ${failure.documentName ?? '(unnamed)'} [${failure.documentIds.join(', ')}]`,
    `Category: ${failure.category}`,
    `HTTP status: ${failure.status ?? 'n/a'}`,
    `Attempts: ${failure.attempts}`,
    `Time: ${failure.occurredAt}`,
    '',
    failure.rawError
  ].join('\n')
}
