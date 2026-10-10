import { inject, provide, shallowRef, type InjectionKey, type ShallowRef } from 'vue'

import {
  CloudPortalAPIError,
  createCloudPortalClient,
  discoverCloud,
  type CloudPortalClient
} from '@open-pencil/cloud/client'
import type { CloudAccountStatus, CloudDiscovery } from '@open-pencil/cloud/contract'

import { createPortalAuth, type PortalAuth } from './auth'

/** Everything a portal page needs about the Cloud server it is served from. */
export type PortalContext = {
  host: string
  discovery: CloudDiscovery
  api: CloudPortalClient
  auth: PortalAuth
  /** The signed-in account and its standing, or null when nobody is signed in. */
  account: ShallowRef<CloudAccountStatus | null>
  refreshAccount(): Promise<CloudAccountStatus | null>
}

const PORTAL_CONTEXT: InjectionKey<PortalContext> = Symbol('cloud-portal')

/** Discovers the server at this page's origin and reads who is signed in. */
export async function loadPortalContext(
  origin = globalThis.location.origin
): Promise<PortalContext> {
  const discovery = await discoverCloud(origin)
  const api = createCloudPortalClient({ baseURL: origin })
  const account = shallowRef<CloudAccountStatus | null>(null)
  async function refreshAccount() {
    try {
      account.value = await api.accountStatus()
    } catch (error) {
      if (!(error instanceof CloudPortalAPIError) || error.kind !== 'authentication-required') {
        throw error
      }
      account.value = null
    }
    return account.value
  }
  await refreshAccount()
  return {
    host: new URL(origin).host,
    discovery,
    api,
    auth: createPortalAuth(discovery),
    account,
    refreshAccount
  }
}

export function providePortal(context: PortalContext): void {
  provide(PORTAL_CONTEXT, context)
}

export function usePortal(): PortalContext {
  const context = inject(PORTAL_CONTEXT)
  if (!context) throw new Error('Cloud portal pages need a portal context')
  return context
}

export { PORTAL_CONTEXT }
