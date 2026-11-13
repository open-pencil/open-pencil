import { computed, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'

import type { ViewportTransform } from '@open-pencil/core/geometry'
import type { Vector } from '@open-pencil/scene-graph/primitives'

type CanvasVirtualReference = {
  getBoundingClientRect: () => DOMRect
}

/**
 * A popover reference at a canvas point. Pass the pan and zoom of the canvas's last drawn frame
 * as `view`, so the popover moves with the picture rather than the live view, which runs ahead
 * of the drawing while panning fast.
 */
export function useCanvasVirtualReference(
  canvasRef: Ref<HTMLElement | null>,
  view: MaybeRefOrGetter<ViewportTransform>,
  anchor: ComputedRef<Vector | null>
) {
  return computed<CanvasVirtualReference | null>(() => {
    const point = anchor.value
    const canvas = canvasRef.value
    if (!point || !canvas) return null

    const { zoom, panX, panY } = toValue(view)

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
