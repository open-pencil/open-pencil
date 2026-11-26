import {
  MAX_REMOTE_FILE_BYTES,
  networkResourceFetch,
  pageResourceFetch
} from '@open-pencil/core/io/remote'
import type { DesignResourceFetch } from '@open-pencil/dom-css'

import { createTauriFetch } from '@/app/tauri/http'
import { IS_TAURI } from '@/constants'

/**
 * The name the desktop app's requests for web files go by: its webview's, as a browser's, since
 * many sites refuse a client that gives none.
 */
const WEB_USER_AGENT = typeof navigator === 'undefined' ? undefined : navigator.userAgent

/**
 * The fetch that reads files from web addresses: the desktop app's own, which reaches any site,
 * or the browser's, which only reaches sites that let other sites read them.
 */
export const remoteFetch: typeof fetch = IS_TAURI
  ? createTauriFetch({ maxResponseBytes: MAX_REMOTE_FILE_BYTES, userAgent: WEB_USER_AGENT })
  : globalThis.fetch.bind(globalThis)

/**
 * A fetch for the files one page loads, such as the pictures its images show; one per page.
 * `pageURL` is the page's own address, none for a page opened from a file or pasted. On desktop it
 * decides which addresses the page's files may come from (`PageResource`); the browser applies its
 * own rules.
 */
export function pageFetch(pageURL?: string): DesignResourceFetch {
  const fetch: typeof globalThis.fetch = IS_TAURI
    ? createTauriFetch({
        maxResponseBytes: MAX_REMOTE_FILE_BYTES,
        pageResource: { page_url: pageURL },
        userAgent: WEB_USER_AGENT
      })
    : remoteFetch
  return pageResourceFetch(networkResourceFetch(fetch))
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
