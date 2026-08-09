import type { ViewportSize } from '@/app/document/io/types'

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

/** Live canvas host size (center panel only — excludes left/right side panels). */
function readCanvasHostSize(): { width: number; height: number } | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector<HTMLCanvasElement>('[data-test-id="canvas-element"]')
  if (!el) return null
  const width = el.clientWidth
  const height = el.clientHeight
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

export function createDocumentViewportActions(editor: ViewportEditor, viewportSize: ViewportSize) {
  function setViewportSize(width: number, height: number) {
    viewportSize.width = width
    viewportSize.height = height
  }

  function syncViewportSizeFromCanvas() {
    const size = readCanvasHostSize()
    if (!size) return false
    viewportSize.width = size.width
    viewportSize.height = size.height
    return true
  }

  /**
   * Fit page content (or deck artboard) into the **canvas host** between side panels.
   * Always re-measures the canvas element so zoom uses the center panel size, not the
   * full window (which would leave the slide clipped under the left/right panels).
   */
  async function fitCurrentPageToViewport() {
    for (let attempt = 0; attempt < 30; attempt++) {
      if (syncViewportSizeFromCanvas()) break
      await yieldToUI()
    }
    await yieldToUI()
    syncViewportSizeFromCanvas()
    editor.zoomToFit()
    // Second pass after layout / filmstrip reflow
    await yieldToUI()
    await yieldToUI()
    syncViewportSizeFromCanvas()
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
