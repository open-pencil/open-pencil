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

/**
 * `fetch`, reporting after each file it is asked for and each it finishes how many of the distinct
 * files asked for so far have finished, failed ones included.
 */
export function countedFetch(
  fetch: DesignResourceFetch,
  report: (completed: number, total: number) => void
): DesignResourceFetch {
  const asked = new Set<string>()
  const finished = new Set<string>()
  return async (url, signal) => {
    if (!asked.has(url)) {
      asked.add(url)
      report(finished.size, asked.size)
    }
    try {
      return await fetch(url, signal)
    } finally {
      if (!finished.has(url)) {
        finished.add(url)
        report(finished.size, asked.size)
      }
    }
  }
}
