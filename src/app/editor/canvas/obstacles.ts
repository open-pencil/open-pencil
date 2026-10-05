import type { Rect } from '@open-pencil/scene-graph/primitives'

/** Marks UI that floats over the canvas, such as the toolbar, for overlays to keep clear of. */
const CANVAS_OBSTACLE_ATTRIBUTE = 'data-canvas-obstacle'

/** Floating UI over a canvas, as rectangles in the canvas's CSS pixels. */
export function canvasOverlayObstacles(canvas: HTMLElement | null): Rect[] {
  if (!canvas) return []
  const box = canvas.getBoundingClientRect()
  return [...document.querySelectorAll(`[${CANVAS_OBSTACLE_ATTRIBUTE}]`)].flatMap((element) => {
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return []
    return [
      { x: rect.left - box.left, y: rect.top - box.top, width: rect.width, height: rect.height }
    ]
  })
}
