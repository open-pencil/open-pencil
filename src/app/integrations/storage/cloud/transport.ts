import type { CloudFetch } from '@open-pencil/cloud/client'

import { storageFetch } from '@/app/integrations/storage/s3/fetch'

export type CloudTransport = {
  apiFetch: CloudFetch
  objectFetch: CloudFetch
}

export function createCloudTransport(): CloudTransport {
  return {
    // Keep API requests in the webview until desktop auth has a native cookie/token handoff.
    apiFetch: globalThis.fetch.bind(globalThis),
    // Object transfers carry no Cloud session and can safely use the native desktop bridge.
    objectFetch: storageFetch
  }
}
