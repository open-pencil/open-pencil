import type { ViewportSize } from '@/app/document/io/types'

/**
 * Ceiling on a document fetched from a URL. Both the browser link and the automation
 * bridge accept an unbounded, caller-supplied URL, and buffering whatever the host
 * sends would let one response exhaust the tab. Well past any real design file.
 */
export const MAX_REMOTE_DOCUMENT_BYTES = 64 * 1024 * 1024

interface BoundedBodyOptions {
  /** Aborts the underlying request when the body exceeds the cap. */
  onExceeded?: () => void
  /** Error message for an oversized body; defaults to the MiB figure. */
  sizeError?: string
}

function oversizedBody(maxBytes: number): string {
  return `exceeds ${Math.floor(maxBytes / (1024 * 1024))} MiB`
}

/**
 * Reads a response body, aborting as soon as it exceeds `maxBytes`. The body is counted
 * chunk by chunk as it streams in: `Content-Length` is the sender's claim, absent on a
 * chunked response and free to lie on any other, so it is only a cheap early exit and
 * the cap itself is enforced on the bytes that actually arrive. `onExceeded` cancels the
 * request instead of draining the rest of an oversized body.
 */
export async function readBoundedBody(
  response: Response,
  maxBytes: number,
  { onExceeded, sizeError }: BoundedBodyOptions = {}
): Promise<Uint8Array<ArrayBuffer>> {
  const fail = (): never => {
    onExceeded?.()
    throw new Error(sizeError ?? oversizedBody(maxBytes))
  }

  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) fail()

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > maxBytes) fail()
    return bytes
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) fail()
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export function resolveBrowserFileURL(path: string): URL {
  const url = new URL(path, window.location.href)
  url.hash = ''
  return url
}

export function yieldToUI(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

type ViewportEditor = {
  zoomToFit: () => void
}

export function createDocumentViewportActions(editor: ViewportEditor, viewportSize: ViewportSize) {
  function setViewportSize(width: number, height: number) {
    viewportSize.width = width
    viewportSize.height = height
  }

  async function fitCurrentPageToViewport() {
    await yieldToUI()
    editor.zoomToFit()
  }

  return { setViewportSize, fitCurrentPageToViewport }
}

export function downloadBlob(data: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mime })
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
