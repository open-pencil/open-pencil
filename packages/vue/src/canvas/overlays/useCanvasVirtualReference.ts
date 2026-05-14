import { computed, type ComputedRef, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type { Vector } from '@open-pencil/core/types'

type CanvasVirtualReference = {
  getBoundingClientRect: () => DOMRect
}

export function useCanvasVirtualReference(
  canvasRef: Ref<HTMLElement | null>,
  editor: Editor,
  anchor: ComputedRef<Vector | null>
) {
  return computed<CanvasVirtualReference | null>(() => {
    const point = anchor.value
    const canvas = canvasRef.value
    if (!point || !canvas) return null

    const zoom = editor.state.zoom
    const panX = editor.state.panX
    const panY = editor.state.panY

    return {
      getBoundingClientRect() {
        const rect = canvas.getBoundingClientRect()
        const x = rect.left + point.x * zoom + panX
        const y = rect.top + point.y * zoom + panY
        return new DOMRect(x, y, 0, 0)
      }
    }
  })
}
