// https://app.openpencil.dev/?file=<https url>&node=<name> — the browser twin of the
// desktop `openpencil://open` link. The desktop variant resolves a repo-relative path
// against open tabs; the web app has no filesystem, so `file` is an absolute `https:`
// URL the browser fetches cross-origin, without credentials and without following a
// redirect. Nothing else is reachable: no `http:`, no `file:`, no other extension.
import { omit } from 'es-toolkit'

import { clamp } from '@/app/document/io/deep-link'
import { notificationMessages } from '@/app/i18n/notifications'
import { openBrowserFileFromURL } from '@/app/shell/menu/files'

export interface WebOpenParams {
  file: URL
  node?: string
}

export interface WebLinkActions {
  /** Selects the node and zooms to it. False when no node carries that name. */
  selectByName: (name: string) => boolean
  notify: (message: string, level: 'info' | 'error') => void
}

/**
 * Pure parser over a `location.search` string. Returns null when the link carries no
 * usable `file`; a present-but-refused `file` also warns once so the cause is visible
 * in the console instead of looking like a silent no-op. A repeated key takes its last
 * value, matching the desktop parser. The accepted URL carries no fragment.
 */
export function parseWebOpenParams(search: string): WebOpenParams | null {
  const params = new URLSearchParams(search)
  const file = params.getAll('file').at(-1)
  if (!file) return null
  let url: URL
  try {
    url = new URL(file)
  } catch {
    console.warn('[Web link] refused a file that is not a URL:', clamp(file))
    return null
  }
  if (url.protocol !== 'https:' || !/\.(?:pen|fig)$/i.test(url.pathname)) {
    console.warn('[Web link] refused file, expected https and .pen or .fig:', clamp(file))
    return null
  }
  // The fragment never reaches the server, so two links that differ only in it name
  // the same document; keeping it would make the tab identity (an exact `href` compare)
  // see two documents and open a duplicate tab for each fragment.
  url.hash = ''
  return { file: url, node: params.getAll('node').at(-1) || undefined }
}

/** Fetch entry point, injected so tests can drive the failure branch. */
export interface WebLinkIo {
  open: (url: URL) => Promise<void>
}

const browserIo: WebLinkIo = {
  // No cookies leave the app for a link-supplied host, and a redirect is refused
  // rather than followed, so an https URL cannot be bounced to a plaintext one.
  open: (url) => openBrowserFileFromURL(url, { credentials: 'omit', redirect: 'error' })
}

export async function openWebLink(
  target: WebOpenParams,
  actions: WebLinkActions,
  io: WebLinkIo = browserIo
): Promise<void> {
  const messages = notificationMessages.get()
  try {
    await io.open(target.file)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    // Host, status text and filename all come from the link: clamp both halves.
    actions.notify(
      messages.openFileFailed({ name: clamp(target.file.host), error: clamp(detail) }),
      'error'
    )
    return
  }
  if (target.node && !actions.selectByName(target.node)) {
    actions.notify(
      messages.deepLinkNodeNotFound({ node: clamp(target.node), file: clamp(target.file.host) }),
      'info'
    )
  }
}

/**
 * The caller's route query minus the link params, so the strip keeps every other key.
 * Router-free on purpose: the router types live in the view, this is just the filter.
 */
export function withoutWebLinkParams<T>(query: Record<string, T>): Record<string, T> {
  return omit(query, ['file', 'node'])
}

/**
 * Handles the link on the current URL. `strip` removes `file` and `node` from the
 * address bar and runs before the document is fetched, so a reload does not re-open
 * and neither a copied nor a later pushed URL carries the payload. It also runs for a
 * refused link, which opened nothing but would otherwise stay in the next copied URL.
 * Stripping is injected because it belongs to the router: rewriting `history` directly
 * leaves the router's own record of the current URL pointing at the un-stripped one,
 * and the next `router.push` writes the params straight back into the history entry.
 */
export async function openWebLinkFromLocation(
  search: string,
  strip: () => void,
  actions: WebLinkActions,
  io: WebLinkIo = browserIo
): Promise<void> {
  const params = new URLSearchParams(search)
  if (!params.has('file') && !params.has('node')) return
  const target = parseWebOpenParams(search)
  strip()
  if (target) await openWebLink(target, actions, io)
}
