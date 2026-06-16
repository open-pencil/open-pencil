import type { ViewportSize } from '@/app/document/io/types'

export function yieldToUI(timeoutMs = 100): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout>
  const animation = new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      clearTimeout(timeoutId)
      resolve()
    })
  })
  const fallback = new Promise<void>((resolve) => {
    timeoutId = setTimeout(() => resolve(), timeoutMs)
  })
  // Race so the UI continues even if requestAnimationFrame is throttled or
  // suspended while the window is hidden. When the animation frame fires
  // first, the fallback timer is cleared to avoid a dangling callback.
  return Promise.race([animation, fallback])
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
  // Pass the TypedArray view directly. Using `data.buffer` would discard
  // `byteOffset`/`byteLength` and include adjacent bytes when `data` is a
  // subarray of a larger ArrayBuffer.
  const blob = new Blob([data as BlobPart], { type: mime })
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
