import type { Editor } from '@open-pencil/core/editor'

export function createProfilerActions(editor: Editor) {
  function viewportScreenCenter() {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-test-id="canvas-element"]')
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }

  function viewportCanvasCenter() {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-test-id="canvas-element"]')
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      return { x: rect.width / 2, y: rect.height / 2 }
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }

  function toggleProfiler() {
    const visible = !(editor.renderer?.profiler.hudVisible ?? false)
    for (const renderer of editor.canvasRenderers) {
      renderer.profiler.setVisible(visible)
    }
    editor.requestRepaint()
  }

  return { viewportScreenCenter, viewportCanvasCenter, toggleProfiler }
}
