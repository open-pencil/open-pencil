import type { ViewportSize } from '@/app/document/io/types'

export function yieldToUI(timeoutMs = 100): Promise<void> {
  const animation = new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
  const fallback = new Promise<void>((resolve) => {
    setTimeout(() => resolve(), timeoutMs)
  })
  // Race so the UI continues even if requestAnimationFrame is throttled or
  // suspended while the window is hidden.
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
