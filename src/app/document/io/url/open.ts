import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { fetchRemoteFile, remoteFileTitle, type RemoteFile } from '@open-pencil/core/io/remote'
import { imageMimeType } from '@open-pencil/scene-graph/images'
import { errorMessage } from '@open-pencil/std/errors'
import { filesMessages } from '@open-pencil/vue/i18n'

import { pastePoint } from '@/app/editor/clipboard/paste/content'
import { closeTab, createDocumentTab, openFileInNewTab } from '@/app/tabs'
import { IS_TAURI } from '@/constants'

import { remoteFetch } from './fetch'
import type { RenderedWebPage } from './render/page'

const io = new IORegistry(BUILTIN_IO_FORMATS)

/**
 * The address a person typed, as a web address: one without a scheme, such as `example.com`, is
 * taken as `https:`. Null for anything that is not an `http:` or `https:` address.
 */
export function parseWebAddress(text: string): URL | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  // `example.com:8443/page` names a port, not a scheme, so it gets one too.
  const hasScheme = /^[a-z][a-z\d+.-]*:(?!\d+(?:[/?#]|$))/i.test(trimmed)
  const withScheme = hasScheme ? trimmed : `https://${trimmed}`
  if (!URL.canParse(withScheme)) return null
  const url = new URL(withScheme)
  return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
}

/** Opens an SVG or a picture in a new design, as dropping it on an empty canvas places it. */
async function openImage(file: File): Promise<void> {
  const tab = createDocumentTab('design')
  const { store } = tab
  try {
    // A picture's size is read with the renderer, which a new tab has once its canvas is ready.
    await store.canvasReady
    const point = pastePoint(store)
    if (!(await store.placeFiles([file], point.x, point.y))) {
      throw new Error(filesMessages.get().openURLUnsupported)
    }
  } catch (error) {
    // A picture that could not be placed leaves no empty design behind.
    await closeTab(tab.id, 'discard')
    throw error
  }
}

/** Why an address could not be read, in words the dialog shows. */
function fetchFailure(error: unknown): string {
  const files = filesMessages.get()
  // The browser reports a site that refuses to be read by other sites as a bare network error.
  if (error instanceof TypeError && !IS_TAURI) return files.openURLBlocked
  return errorMessage(error)
}

/**
 * The page as its scripts build it, rendered by the desktop app, or null when it cannot be,
 * including when the renderer itself fails to load. The renderer and the scripts it runs in the
 * page are loaded only on desktop, where they are used.
 */
async function renderOnDesktop(url: string): Promise<RenderedWebPage | null> {
  try {
    const { renderWebPage } = await import('./render/page')
    return await renderWebPage(url)
  } catch {
    return null
  }
}

/**
 * Opens what a web address holds: a page as editable layers, as opening an HTML file does but with
 * the stylesheets and pictures it links; a design document as File → Open does; and an SVG or a
 * picture in a new design. Throws, with words for the person, for anything it cannot open.
 */
export async function openWebAddress(url: URL, signal?: AbortSignal): Promise<void> {
  const files = filesMessages.get()
  let remote: RemoteFile
  try {
    remote = await fetchRemoteFile(url, { fetch: remoteFetch, signal, io })
  } catch (error) {
    throw new Error(fetchFailure(error), { cause: error })
  }
  // Closing the dialog while the address loaded leaves nothing opened.
  signal?.throwIfAborted()
  switch (remote.kind) {
    case 'html': {
      // The desktop app renders the page, so a page its scripts build opens as it shows; the
      // HTML its server sent stands in when it cannot be rendered, and in the browser.
      const rendered = IS_TAURI ? await renderOnDesktop(remote.url) : null
      signal?.throwIfAborted()
      const html = rendered ? new TextEncoder().encode(rendered.html) : remote.bytes
      const pageURL = rendered?.url ?? remote.url
      // A page its scripts sent elsewhere is named after where it ended up.
      const title = rendered ? remoteFileTitle(new URL(rendered.url)) : remote.title
      await openFileInNewTab(new File([html], remote.name || title), {
        path: pageURL,
        webPage: { url: pageURL, title },
        signal
      })
      return
    }
    case 'document':
      // Opened as a picked file is: its address is no file path a save could write back to.
      await openFileInNewTab(new File([remote.bytes], remote.name), { signal })
      return
    case 'svg':
      await openImage(
        new File([remote.bytes], remote.name || remote.title, { type: 'image/svg+xml' })
      )
      return
    case 'image':
      // A raw file host may serve a picture as anything, so its type comes from its bytes.
      await openImage(
        new File([remote.bytes], remote.name || remote.title, { type: imageMimeType(remote.bytes) })
      )
      return
    case 'pdf':
      throw new Error(files.openURLPDF)
    case 'unsupported':
      throw new Error(files.openURLUnsupported)
  }
}
