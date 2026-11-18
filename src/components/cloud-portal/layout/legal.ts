import { inject, type InjectionKey } from 'vue'

import type { CloudLegalDiscovery } from '@open-pencil/cloud/contract'

/**
 * The server's legal links, which every public portal page shows in its footer. The portal's root
 * provides them from discovery; a server that names none provides nothing.
 */
export const PORTAL_LEGAL: InjectionKey<CloudLegalDiscovery | undefined> = Symbol('portal-legal')

export function usePortalLegal(): CloudLegalDiscovery | undefined {
  return inject(PORTAL_LEGAL, undefined)
}
