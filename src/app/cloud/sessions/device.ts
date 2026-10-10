import { shallowRef } from 'vue'

import {
  CloudDeviceAuthorizationError,
  pollCloudDeviceToken,
  requestCloudDeviceAuthorization,
  type CloudFetch
} from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

import { openExternalLink } from '@/app/shell/ui'

import { clearCloudSessionToken, saveCloudSessionToken } from './token'

/** A device-code sign-in: waiting for approval in the browser, or how it ended. */
export type CloudDeviceSignIn =
  | { status: 'idle' }
  | { status: 'waiting'; code: string; verificationURL: string; expiresAt: number }
  | { status: 'signed-in' }
  | { status: 'denied' | 'expired' | 'failed' }

export type CloudDeviceSignInDependencies = {
  request: typeof requestCloudDeviceAuthorization
  poll: typeof pollCloudDeviceToken
  open(url: string): Promise<void>
  save(serverId: string, token: string): Promise<void>
  clear(serverId: string): Promise<void>
}

const defaults: CloudDeviceSignInDependencies = {
  request: requestCloudDeviceAuthorization,
  poll: pollCloudDeviceToken,
  open: openExternalLink,
  save: saveCloudSessionToken,
  clear: clearCloudSessionToken
}

/**
 * Signing in by approving a code on the server's page. The app opens the page, waits for the
 * approval, and keeps the token it gets. Starting again or cancelling drops the attempt, and a
 * token that arrives after that is cleared rather than kept.
 */
export function createCloudDeviceSignIn(dependencies: CloudDeviceSignInDependencies = defaults) {
  const state = shallowRef<CloudDeviceSignIn>({ status: 'idle' })
  let controller: AbortController | null = null

  function cancel(): void {
    controller?.abort(new DOMException('Sign-in cancelled', 'AbortError'))
    controller = null
    state.value = { status: 'idle' }
  }

  async function start(
    serverId: string,
    discovery: CloudDiscovery,
    fetch?: CloudFetch
  ): Promise<boolean> {
    cancel()
    const attempt = new AbortController()
    controller = attempt
    const { signal } = attempt
    try {
      const authorization = await dependencies.request(discovery, serverId, { fetch })
      signal.throwIfAborted()
      state.value = {
        status: 'waiting',
        code: authorization.user_code,
        verificationURL: authorization.verification_uri_complete,
        expiresAt: Date.now() + authorization.expires_in * 1000
      }
      await dependencies.open(authorization.verification_uri_complete)
      const token = await dependencies.poll(discovery, serverId, authorization, { signal, fetch })
      signal.throwIfAborted()
      await dependencies.save(serverId, token.access_token)
      if (signal.aborted) {
        await dependencies.clear(serverId)
        return false
      }
      state.value = { status: 'signed-in' }
      return true
    } catch (error) {
      if (signal.aborted) return false
      state.value = {
        status:
          error instanceof CloudDeviceAuthorizationError && error.code !== 'unavailable'
            ? error.code
            : 'failed'
      }
      return false
    } finally {
      if (controller === attempt) controller = null
    }
  }

  /** Opens the approval page again, for when the person closed it. */
  async function reopen(): Promise<void> {
    if (state.value.status === 'waiting') await dependencies.open(state.value.verificationURL)
  }

  return { state, start, cancel, reopen }
}
