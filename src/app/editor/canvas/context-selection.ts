import type { Ref } from 'vue'

import { hitTestGuides } from '@open-pencil/core/canvas'

import type { EditorStore } from '@/app/editor/active-store'

export function createCanvasContextSelection(
  canvasRef: Ref<HTMLCanvasElement | null>,
  store: EditorStore
) {
  function selectAtContextPoint(event: MouseEvent) {
    const canvas = canvasRef.value
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = event.clientX - rect.left
    const sy = event.clientY - rect.top
    const guide = hitTestGuides(
      store.graph,
      store.state.currentPageId,
      {
        panX: store.state.panX,
        panY: store.state.panY,
        zoom: store.state.zoom,
        width: rect.width,
        height: rect.height
      },
      sx,
      sy
    )
    if (guide) {
      store.setSelectedGuide({ ownerId: guide.ownerId, guideId: guide.guideId })
      return
    }
    store.setSelectedGuide(null)
    const { x: cx, y: cy } = store.screenToCanvas(sx, sy)
    store.selectAtPoint(cx, cy)
  }

  return { selectAtContextPoint }
}
