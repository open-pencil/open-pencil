import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import type { ViewportTransform } from './types'

/** Where a page x lands on the canvas, in CSS pixels from its left edge. */
export function worldXToScreen(view: ViewportTransform, x: number): number {
  return x * view.zoom + view.panX
}

/** Where a page y lands on the canvas, in CSS pixels from its top edge. */
export function worldYToScreen(view: ViewportTransform, y: number): number {
  return y * view.zoom + view.panY
}

/** Where a page point lands on the canvas, in CSS pixels from its top-left corner. */
export function worldToScreen(view: ViewportTransform, point: Vector): Vector {
  return { x: worldXToScreen(view, point.x), y: worldYToScreen(view, point.y) }
}

/** The page x under a canvas x given in CSS pixels from its left edge. */
export function screenXToWorld(view: ViewportTransform, x: number): number {
  return (x - view.panX) / view.zoom
}

/** The page y under a canvas y given in CSS pixels from its top edge. */
export function screenYToWorld(view: ViewportTransform, y: number): number {
  return (y - view.panY) / view.zoom
}

/** The page point under a canvas point given in CSS pixels from its top-left corner. */
export function screenToWorld(view: ViewportTransform, point: Vector): Vector {
  return { x: screenXToWorld(view, point.x), y: screenYToWorld(view, point.y) }
}

/** Where a page rectangle lands on the canvas, in CSS pixels. */
export function worldRectToScreen(view: ViewportTransform, rect: Rect): Rect {
  return {
    x: worldXToScreen(view, rect.x),
    y: worldYToScreen(view, rect.y),
    width: rect.width * view.zoom,
    height: rect.height * view.zoom
  }
}

/** The page point at the middle of a canvas `width` by `height` CSS pixels. */
export function screenCenterInWorld(
  view: ViewportTransform,
  width: number,
  height: number
): Vector {
  return screenToWorld(view, { x: width / 2, y: height / 2 })
}
