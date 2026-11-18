import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { fetchRemoteFile, type RemoteFile } from '@open-pencil/core/io/remote'
import { imageMimeType } from '@open-pencil/scene-graph/images'
import { filesMessages } from '@open-pencil/vue/i18n'

import { pastePoint } from '@/app/editor/clipboard/paste/content'
import { createDocumentTab, openFileInNewTab } from '@/app/tabs'
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

/** A file named so the tab that opens it reads it as what it is, such as `example.com.html`. */
function fileFor(remote: RemoteFile, extension: string, type = ''): File {
  const name = remote.name.toLowerCase().endsWith(extension)
    ? remote.name
    : `${remote.name}${extension}`
  return new File([remote.bytes], name, { type })
}

/** Opens an SVG or a picture in a new design, as dropping it on an empty canvas places it. */
async function openImage(file: File): Promise<void> {
  const { store } = createDocumentTab('design')
  const point = pastePoint(store)
  await store.placeFiles([file], point.x, point.y)
}

/** Why an address could not be read, in words the dialog shows. */
function fetchFailure(error: unknown): string {
  const files = filesMessages.get()
  // The browser reports a site that refuses to be read by other sites as a bare network error.
  if (error instanceof TypeError && !IS_TAURI) return files.openURLBlocked
  return error instanceof Error ? error.message : String(error)
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
    case 'html':
      await openFileInNewTab(fileFor(remote, '.html', 'text/html'), undefined, remote.url)
      return
    case 'document':
      // Opened as a picked file is: its address is no file path a save could write back to.
      await openFileInNewTab(new File([remote.bytes], remote.name))
      return
    case 'svg':
      await openImage(fileFor(remote, '.svg', 'image/svg+xml'))
      return
    case 'image':
      // A raw file host may serve a picture as anything, so its type comes from its bytes.
      await openImage(new File([remote.bytes], remote.name, { type: imageMimeType(remote.bytes) }))
      return
    case 'pdf':
      throw new Error(files.openURLPDF)
    case 'unsupported':
      throw new Error(files.openURLUnsupported)
  }
}
