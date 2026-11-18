import { nextShownFrame } from '@open-pencil/vue/shared/frame'

/**
 * Ceiling on a document fetched from a URL. Both the browser link and the automation
 * bridge accept an unbounded, caller-supplied URL, and buffering whatever the host
 * sends would let one response exhaust the tab. Well past any real design file.
 */
export const MAX_REMOTE_DOCUMENT_BYTES = 64 * 1024 * 1024

export function resolveBrowserFileURL(path: string): URL {
  const url = new URL(path, window.location.href)
  url.hash = ''
  return url
}

type ViewportEditor = {
  zoomToFit: () => void
}

/** Fits the page once the canvas has its size; `signal` stops waiting for it. */
export async function fitPageToViewport(editor: ViewportEditor, signal?: AbortSignal) {
  await nextShownFrame({ signal })
  editor.zoomToFit()
}

export function downloadBlob(data: Uint8Array | Blob, filename: string, mime: string) {
  // A copy, not `data.buffer`: a view would download the whole buffer it looks into.
  const blob = data instanceof Blob ? data : new Blob([data.slice()], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}
