import {
  MAX_REMOTE_FILE_BYTES,
  networkResourceFetch,
  pageResourceFetch
} from '@open-pencil/core/io/remote'
import type { DesignResourceFetch } from '@open-pencil/dom-css'

import { tauriFetch } from '@/app/tauri/http'
import { IS_TAURI } from '@/constants'

/**
 * The fetch that reads files from web addresses: the desktop app's own, which reaches any site,
 * or the browser's, which only reaches sites that let other sites read them.
 */
export const remoteFetch: typeof fetch = IS_TAURI
  ? (input, init) => tauriFetch(input, init, MAX_REMOTE_FILE_BYTES)
  : globalThis.fetch.bind(globalThis)

/** A fetch for the files one page loads, such as the pictures its images show; one per page. */
export function pageFetch(): DesignResourceFetch {
  return pageResourceFetch(networkResourceFetch(remoteFetch))
}
