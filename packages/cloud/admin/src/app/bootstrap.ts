import {
  CLOUD_BOOTSTRAP_ID,
  parseCloudBootstrap,
  type CloudDiscovery
} from '@open-pencil/cloud/contract'

export function readCloudBootstrap(document: Document): CloudDiscovery {
  const element = document.getElementById(CLOUD_BOOTSTRAP_ID)
  if (!element?.textContent) throw new Error('OpenPencil Cloud configuration is unavailable')
  return parseCloudBootstrap(element.textContent)
}
