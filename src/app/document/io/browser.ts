import type { ViewportSize } from '@/app/document/io/types'

type AnimationFrameGlobals = Partial<
  Pick<typeof globalThis, 'requestAnimationFrame' | 'cancelAnimationFrame'>
>

export function yieldToUI(timeoutMs = 100): Promise<void> {
  const g = globalThis as AnimationFrameGlobals
  const requestAnimationFrame =
    g.requestAnimationFrame ??
    ((cb: (time: number) => void) => {
      cb(0)
      return 0
    })
  const cancelAnimationFrame = g.cancelAnimationFrame ?? (() => undefined)

  return new Promise<void>((resolve) => {
    let resolved = false
    const settle = () => {
      if (resolved) return
      resolved = true
      resolve()
    }

    // Schedule the fallback timer first so a synchronous rAF callback (e.g.
    // a runtime polyfill) can clear it before it fires, preventing a dangling
    // timeout when requestAnimationFrame is unavailable.
    let animationFrameId = 0
    const timeoutId = setTimeout(() => {
      cancelAnimationFrame(animationFrameId)
      settle()
    }, timeoutMs)

    animationFrameId = requestAnimationFrame(() => {
      clearTimeout(timeoutId)
      settle()
    })
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
