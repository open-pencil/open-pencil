import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { UseCanvasOptions } from '#vue/canvas/surface/types'

export function createCanvasOriginTracker(onMove: UseCanvasOptions['onViewportMove']) {
  let origin: Vector | null = null

  return {
    place(next: Vector) {
      const previous = origin
      origin = next
      if (!onMove || !previous || (previous.x === next.x && previous.y === next.y)) {
        return
      }
      onMove(next.x - previous.x, next.y - previous.y)
    }
  }
}
