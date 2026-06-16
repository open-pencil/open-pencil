import type { ViewportSize } from '@/app/document/io/types'

export function yieldToUI(timeoutMs = 100): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout>
  let animationFrameId: number
  const animation = new Promise<void>((resolve) => {
    let resolved = false
    const settle = () => {
      if (resolved) return
      resolved = true
      resolve()
    }

    animationFrameId = requestAnimationFrame(() => {
      clearTimeout(timeoutId)
      settle()
    })
  })
  const fallback = new Promise<void>((resolve) => {
    let resolved = false
    const settle = () => {
      if (resolved) return
      resolved = true
      resolve()
    }

    timeoutId = setTimeout(() => {
      cancelAnimationFrame(animationFrameId)
      settle()
    }, timeoutMs)
  })
  // Race so the UI continues even if requestAnimationFrame is throttled or
  // suspended while the window is hidden. Whichever callback fires first
  // cancels the other to avoid leaving dangling timers or rAF callbacks.
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
