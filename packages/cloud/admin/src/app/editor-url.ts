import type { CloudDiscovery } from '@open-pencil/cloud/contract'

export function editorURL(discovery: CloudDiscovery): string {
  return discovery.appURL ?? new URL('/', discovery.apiURL).href
}
