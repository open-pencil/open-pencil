import type { ViewportTransform } from '@open-pencil/core/geometry'
import type { Vector } from '@open-pencil/scene-graph/primitives'

/** Where a page sits inside the layer that pans and zooms, in that layer's own pixels. */
export type PagePlacement = {
  left: number
  top: number
  width: number
  height: number
}

/**
 * A page covers its frame's border box and nothing more: the frame keeps its fill, stroke, and
 * radius, and a page can never draw outside the frame that holds it.
 */
export function pagePlacement(at: Vector, width: number, height: number): PagePlacement {
  return { left: at.x, top: at.y, width, height }
}

/**
 * The pan and zoom of a canvas pane, as the transform of the layer that holds pages. Pages scale
 * with the canvas the way a frame's shapes do, and every page shares one transform, so panning
 * moves them together.
 */
export function layerTransform(view: ViewportTransform): string {
  return `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`
}
