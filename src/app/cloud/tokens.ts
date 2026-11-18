import type { CloudServicesTokenSource } from '@open-pencil/cloud/client'
import { DEADLINE_MS, TOKEN_REFRESH_MARGIN_MS, untilAborted } from '@open-pencil/scene-graph/timing'

/** A signing request that hasn't answered by now fails, so the next request asks again. */
const SIGNING_DEADLINE_MS = DEADLINE_MS.slowRequest

/** A token source that can also forget its token, as when the plan the token carries changes. */
export interface CloudTokenCache extends CloudServicesTokenSource {
  /** Forgets the held token, so the next request signs a new one. */
  reset(): void
}

/**
 * Keeps one short-lived token Cloud signs for a service, such as a workspace's AI or an account's
 * billing, signing a new one shortly before it expires.
 */
export function createCloudTokenCache(
  request: () => Promise<{ token: string; expiresAt: string }>,
  now: () => number = Date.now,
  deadlineMs = SIGNING_DEADLINE_MS
): CloudTokenCache {
  let current: { token: string; expiresAt: number } | null = null
  let pending: Promise<string> | null = null
  // A reset starts a new generation: a token signed before it answers its own caller but is
  // never kept or handed to a later one.
  let generation = 0
  return {
    token() {
      if (current && current.expiresAt - TOKEN_REFRESH_MARGIN_MS > now()) {
        return Promise.resolve(current.token)
      }
      if (pending) return pending
      const signing = generation
      const next = untilAborted(request(), AbortSignal.timeout(deadlineMs))
        .then(({ token, expiresAt }) => {
          if (signing === generation) current = { token, expiresAt: Date.parse(expiresAt) }
          return token
        })
        .finally(() => {
          if (pending === next) pending = null
        })
      pending = next
      return next
    },
    invalidate(token) {
      if (current?.token === token) current = null
    },
    reset() {
      generation += 1
      current = null
      pending = null
    }
  }
}
