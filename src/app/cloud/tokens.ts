import type { CloudServicesTokenSource } from '@open-pencil/cloud/client'

/** A token this close to expiring is replaced, so a long request does not outlive it. */
const REFRESH_MARGIN_MS = 60_000

/**
 * Keeps one short-lived token Cloud signs for a service, such as a workspace's AI or an account's
 * billing, signing a new one shortly before it expires.
 */
export function createCloudTokenCache(
  request: () => Promise<{ token: string; expiresAt: string }>,
  now: () => number = Date.now
): CloudServicesTokenSource & { reset(): void } {
  let current: { token: string; expiresAt: number } | null = null
  let pending: Promise<string> | null = null
  // A reset starts a new generation: a token signed before it answers its own caller but is
  // never kept or handed to a later one.
  let generation = 0
  return {
    token() {
      if (current && current.expiresAt - REFRESH_MARGIN_MS > now()) {
        return Promise.resolve(current.token)
      }
      if (pending) return pending
      const signing = generation
      const next = request()
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
    /** Forgets the held token, so the next request signs a new one. */
    reset() {
      generation += 1
      current = null
      pending = null
    }
  }
}
