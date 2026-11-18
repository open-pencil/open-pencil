import { shallowRef, type Ref } from 'vue'

import { hitTestGuides, type SkiaRenderer } from '@open-pencil/core/canvas'

import type { EditorStore } from '@/app/editor/active-store'

/** What a right-click on the canvas landed on, which picks the menu it opens. */
export type CanvasContextTarget = 'guide' | 'layer' | 'canvas'

export function createCanvasContextSelection(
  canvasRef: Ref<HTMLCanvasElement | null>,
  store: EditorStore,
  /** This pane's overlay canvas, which paints frame, section, and component names. */
  getOverlayRenderer: () => SkiaRenderer | null
) {
  const contextTarget = shallowRef<CanvasContextTarget>('canvas')

  function selectAtContextPoint(event: MouseEvent) {
    const canvas = canvasRef.value
    if (!canvas) return
    // Overlays such as comment pins handle their own right-click.
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('[data-canvas-overlay]')) return
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
      contextTarget.value = 'guide'
      return
    }
    // The Comment tool selects the layer under a right-click but keeps the selection over empty
    // canvas, as in Figma.
    const commenting = store.state.activeTool === 'COMMENT'
    const { x: cx, y: cy } = store.screenToCanvas(sx, sy)
    const hit = store.selectAtPoint(cx, cy, getOverlayRenderer(), {
      keepSelectionOnMiss: commenting
    })
    if (hit || !commenting) store.setSelectedGuide(null)
    contextTarget.value = hit ? 'layer' : 'canvas'
  }

  return { selectAtContextPoint, contextTarget }
}
