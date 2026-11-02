import type { CloudAITokenSource } from '@open-pencil/cloud/client'
import type { AIToken } from '@open-pencil/cloud/contract'

/** A token this close to expiring is replaced, so a long request does not outlive it. */
const REFRESH_MARGIN_MS = 60_000

/** Keeps one workspace's AI token, signing a new one shortly before it expires. */
export function createCloudAITokens(
  request: () => Promise<AIToken>,
  now: () => number = Date.now
): CloudAITokenSource {
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
