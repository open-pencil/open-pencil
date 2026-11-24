import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import {
  fetchRemoteFile,
  RefusedPageError,
  remoteFileTitle,
  type RemoteFile
} from '@open-pencil/core/io/remote'
import type { DesignViewport } from '@open-pencil/dom-css'
import { imageMimeType } from '@open-pencil/scene-graph/images'
import { errorMessage } from '@open-pencil/std/errors'
import { messageStores } from '@open-pencil/vue/i18n'

import { pastePoint } from '@/app/editor/clipboard/paste/content'
import { closeTab, createDocumentTab, openFileInNewTab } from '@/app/tabs'
import { IS_TAURI } from '@/constants'

import { remoteFetch } from './fetch'

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
      throw new Error(messageStores.files.get().openURLUnsupported)
    }
  } catch (error) {
    // A picture that could not be placed leaves no empty design behind.
    await closeTab(tab.id, 'discard')
    throw error
  }
}

/** Why an address could not be read, in words the dialog shows. */
function fetchFailure(error: unknown): string {
  const files = messageStores.files.get()
  // The browser reports a site that refuses to be read by other sites as a bare network error.
  if (error instanceof TypeError && !IS_TAURI) return files.openURLBlocked
  if (error instanceof RefusedPageError) return files.openURLRefused
  return errorMessage(error)
}

/** What a web address holds that OpenPencil opens: a page, a design document, or a picture. */
export type OpenableRemoteFile = RemoteFile & {
  kind: 'html' | 'document' | 'svg' | 'image'
  /**
   * The site refused the app's request for the page, as one it took for a bot, so it has no HTML
   * of its own here and opens only as the desktop app renders it, loading the page as a browser.
   */
  rendersOnly?: boolean
}

/** A page its site refused the app, to be loaded by the desktop app's render window. */
function refusedPage(url: URL): OpenableRemoteFile {
  return {
    url: url.href,
    name: '',
    title: remoteFileTitle(url),
    contentType: 'text/html',
    bytes: new Uint8Array(),
    kind: 'html',
    rendersOnly: true
  }
}

/** How a web page is opened: the window it is laid out in, and whether its scripts run first. */
export interface WebPageOpenOptions {
  viewport?: DesignViewport
  /** Runs the page's scripts in the desktop app before importing what they built. */
  runScripts?: boolean
}

/**
 * Reads what a web address holds. Throws, with words for the person, when it cannot be read or
 * holds nothing OpenPencil opens, so the address can be corrected before anything opens.
 */
export async function fetchWebAddress(url: URL, signal?: AbortSignal): Promise<OpenableRemoteFile> {
  const files = messageStores.files.get()
  let remote: RemoteFile
  try {
    remote = await fetchRemoteFile(url, { fetch: remoteFetch, signal, io })
  } catch (error) {
    if (error instanceof RefusedPageError && IS_TAURI) return refusedPage(error.url)
    throw new Error(fetchFailure(error), { cause: error })
  }
  signal?.throwIfAborted()
  if (remote.kind === 'pdf') throw new Error(files.openURLPDF)
  if (remote.kind === 'unsupported') throw new Error(files.openURLUnsupported)
  return { ...remote, kind: remote.kind }
}

/**
 * Opens what a web address held in a tab of its own: a page as editable layers, as opening an
 * HTML file does but with the stylesheets and pictures it links, laid out in `viewport` and, on
 * desktop, built by its scripts first; a design document as File → Open does; and an SVG or a
 * picture in a new design. The tab shows how far it has got, and closing it cancels the open.
 */
export async function openRemoteFile(
  remote: OpenableRemoteFile,
  { viewport, runScripts = true }: WebPageOpenOptions = {}
): Promise<void> {
  switch (remote.kind) {
    case 'html': {
      const render = IS_TAURI && runScripts
      if (remote.rendersOnly && !render)
        throw new Error(messageStores.files.get().openURLRefused)
      await openFileInNewTab(new File([remote.bytes], remote.name || remote.title), {
        path: remote.url,
        webPage: {
          url: remote.url,
          title: remote.title,
          viewport,
          render,
          rendersOnly: remote.rendersOnly
        }
      })
      return
    }
    case 'document':
      // Opened as a picked file is: its address is no file path a save could write back to.
      await openFileInNewTab(new File([remote.bytes], remote.name))
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
  }
}

/** Reads a web address and opens what it holds; see `fetchWebAddress` and `openRemoteFile`. */
export async function openWebAddress(
  url: URL,
  options: WebPageOpenOptions & { signal?: AbortSignal } = {}
): Promise<void> {
  await openRemoteFile(await fetchWebAddress(url, options.signal), options)
}
