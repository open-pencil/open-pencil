import type { Canvas, Color, Paint } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { createSceneGeometry, type RotationPreview } from '#core/geometry'

/** An outline sized in screen pixels, so it looks the same at every zoom. */
export interface ScreenStroke {
  color: Color
  /** Line width in screen pixels; one by default. */
  width?: number
  /** Dash and gap lengths in screen pixels; a solid line without. */
  dash?: readonly [dash: number, gap: number]
}

/**
 * Draw with the shared stroke paint set to `stroke` at the live zoom. Editor chrome draws this
 * way, every frame, in the overlay pass: the scene is cached and scaled while navigating, so
 * anything sized by the zoom must not be drawn there. The paint is reset and the dash freed
 * afterwards, since the paint is shared and a dash is native memory.
 */
export function withScreenStroke(
  r: SkiaRenderer,
  stroke: ScreenStroke,
  draw: (paint: Paint) => void
): void {
  const dash = stroke.dash
    ? r.ck.PathEffect.MakeDash([stroke.dash[0] / r.zoom, stroke.dash[1] / r.zoom], 0)
    : null
  r.auxStroke.setStrokeWidth((stroke.width ?? 1) / r.zoom)
  r.auxStroke.setColor(stroke.color)
  r.auxStroke.setPathEffect(dash)
  try {
    draw(r.auxStroke)
  } finally {
    r.auxStroke.setPathEffect(null)
    dash?.delete()
  }
}

/** Draw in `node`'s own coordinates, placed where it is on screen. */
export function inNodeSpace(
  r: SkiaRenderer,
  canvas: Canvas,
  geometry: ReturnType<typeof createSceneGeometry>,
  node: SceneNode,
  draw: () => void
): void {
  canvas.save()
  try {
    canvas.concat(geometry.screenMatrix(node, r))
    draw()
  } finally {
    canvas.restore()
  }
}

/** Outline the bounds of the layer `nodeId`, if it exists, with `stroke`. */
export function outlineNode(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  nodeId: string | null | undefined,
  stroke: ScreenStroke,
  preview?: RotationPreview | null
): void {
  const node = nodeId ? graph.getNode(nodeId) : undefined
  if (!node) return
  inNodeSpace(r, canvas, createSceneGeometry(graph, preview), node, () =>
    withScreenStroke(r, stroke, (paint) =>
      canvas.drawRect(r.ck.LTRBRect(0, 0, node.width, node.height), paint)
    )
  )
}
