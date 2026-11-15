import { computed, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'

import { worldToScreen, type ViewportTransform } from '@open-pencil/core/geometry'
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

    const screen = worldToScreen(toValue(view), point)

    return {
      getBoundingClientRect() {
        const rect = canvas.getBoundingClientRect()
        return new DOMRect(rect.left + screen.x, rect.top + screen.y, 0, 0)
      }
    }
  })
}
