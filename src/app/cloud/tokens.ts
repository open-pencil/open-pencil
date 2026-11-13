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
): CloudServicesTokenSource {
  let current: { token: string; expiresAt: number } | null = null
  let pending: Promise<string> | null = null
  return {
    token() {
      if (current && current.expiresAt - REFRESH_MARGIN_MS > now()) {
        return Promise.resolve(current.token)
      }
      pending ??= request()
        .then(({ token, expiresAt }) => {
          current = { token, expiresAt: Date.parse(expiresAt) }
          return token
        })
        .finally(() => {
          pending = null
        })
      return pending
    },
    invalidate(token) {
      if (current?.token === token) current = null
    }
  }
}
