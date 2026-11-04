import type { Editor } from '@open-pencil/core'
import type { Rect } from '@open-pencil/scene-graph/primitives'

export function createProfilerActions(editor: Editor, getViewportBounds: () => Rect) {
  function viewportCanvasCenter() {
    const { x, y, width, height } = getViewportBounds()
    return { x: x + width / 2, y: y + height / 2 }
  }

  function toggleProfiler() {
    const visible = !(editor.renderer?.profiler.hudVisible ?? false)
    for (const renderer of editor.canvasRenderers) {
      renderer.profiler.setVisible(visible)
    }
    editor.requestRepaint()
  }

  return { viewportCanvasCenter, toggleProfiler }
}
