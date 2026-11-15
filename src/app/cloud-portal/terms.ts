import { computed } from 'vue'

import type { CloudPortalClient } from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

import type { PortalAuth } from './auth'
import { usePortal } from './context'
import { usePortalFailureMessages } from './failure'
import { usePortalAction } from './state'

export type PortalTermsOptions = {
  /** The account accepted the current terms and may use the server: the page goes on. */
  onAccepted(): unknown
  /** The person declined and is signed out: the page leaves. */
  onSignedOut(): unknown
}

/** What accepting and declining reach of the portal. */
export type PortalTermsServices = {
  discovery: Pick<CloudDiscovery, 'legal'>
  api: Pick<CloudPortalClient, 'acceptTerms'>
  auth: Pick<PortalAuth, 'signOut'>
  refreshAccount(): Promise<unknown>
}

/**
 * Accepting or declining the server's current terms. Accepting names the version this page loaded,
 * so terms replaced since then answer `terms_changed`, which asks for a reload; declining signs
 * out. Only the latest attempt's failure is shown. It reports what happened; the page moves on.
 */
export function usePortalTerms(
  options: PortalTermsOptions,
  portal: PortalTermsServices = usePortal()
) {
  const { failure } = usePortalFailureMessages()
  const legal = computed(() => portal.discovery.legal)

  const accepting = usePortalAction(async () => {
    declining.clear()
    const version = legal.value?.termsVersion
    if (!version) return
    await portal.api.acceptTerms(version)
    await portal.refreshAccount()
    await options.onAccepted()
  })

  const declining = usePortalAction(async () => {
    accepting.clear()
    const result = await portal.auth.signOut()
    if (!result.ok) {
      declining.fail(failure(result.failure))
      return
    }
    await portal.refreshAccount()
    await options.onSignedOut()
  })

  return {
    legal,
    busy: computed(() => accepting.busy.value || declining.busy.value),
    error: computed(() => declining.error.value ?? accepting.error.value),
    accept: () => accepting.run(),
    decline: () => declining.run()
  }
}
