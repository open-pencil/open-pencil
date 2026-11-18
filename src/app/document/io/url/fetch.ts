import { MAX_REMOTE_FILE_BYTES, readBoundedBody } from '@open-pencil/core/io/remote'

import { tauriFetch } from '@/app/tauri/http'
import { IS_TAURI } from '@/constants'

/**
 * The fetch that reads files from web addresses: the desktop app's own, which reaches any site,
 * or the browser's, which only reaches sites that let other sites read them.
 */
export const remoteFetch: typeof fetch = IS_TAURI
  ? (input, init) => tauriFetch(input, init, MAX_REMOTE_FILE_BYTES)
  : globalThis.fetch.bind(globalThis)

/** The bytes at a web address, such as a picture a page shows, or null when they cannot be read. */
export async function fetchRemoteBytes(
  url: string,
  signal?: AbortSignal
): Promise<Uint8Array | null> {
  try {
    const response = await remoteFetch(url, { signal })
    return response.ok ? await readBoundedBody(response, MAX_REMOTE_FILE_BYTES) : null
  } catch {
    return null
  }
}
