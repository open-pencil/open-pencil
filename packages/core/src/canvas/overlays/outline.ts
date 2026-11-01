import type { Canvas, Color, Paint, PathEffect } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { ResourceCache } from '#core/cache/resource'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { strokeNodeShape } from '#core/canvas/strokes'
import { SECTION_HOVER_STROKE_WIDTH } from '#core/constants'
import type { RotationPreview, SceneGeometry } from '#core/geometry'

/** Dashes drawn each frame, by their on and off lengths at the zoom they were made for. */
const MAX_CACHED_DASHES = 32

export type DashEffectCache = ResourceCache<string, PathEffect>

export function createDashEffectCache(): DashEffectCache {
  return new ResourceCache({ maxEntries: MAX_CACHED_DASHES, dispose: (effect) => effect.delete() })
}

/** A dash of `on` and `off` lengths, kept between frames; the paint it goes on borrows it. */
export function dashEffect(r: SkiaRenderer, on: number, off: number, phase = 0): PathEffect {
  const key = `${on},${off},${phase}`
  const cached = r.dashEffects.get(key)
  if (cached) return cached
  const effect = r.ck.PathEffect.MakeDash([on, off], phase)
  r.dashEffects.set(key, effect)
  return effect
}

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
 * anything sized by the zoom must not be drawn there. The paint is reset afterwards, since it is
 * shared; the dash comes from the renderer's cache, so a frame makes none.
 */
export function withScreenStroke(
  r: SkiaRenderer,
  stroke: ScreenStroke,
  draw: (paint: Paint) => void
): void {
  const dash = stroke.dash ? dashEffect(r, stroke.dash[0] / r.zoom, stroke.dash[1] / r.zoom) : null
  r.auxStroke.setStrokeWidth((stroke.width ?? 1) / r.zoom)
  r.auxStroke.setColor(stroke.color)
  if (dash) r.auxStroke.setPathEffect(dash)
  try {
    draw(r.auxStroke)
  } finally {
    if (dash) r.auxStroke.setPathEffect(null)
  }
}

/** Draw in `node`'s own coordinates, placed where it is on screen. */
export function inNodeSpace(
  r: SkiaRenderer,
  canvas: Canvas,
  geometry: SceneGeometry,
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
  inNodeSpace(r, canvas, r.sceneGeometry(graph, preview), node, () =>
    withScreenStroke(r, stroke, (paint) =>
      canvas.drawRect(r.ltrb(0, 0, node.width, node.height), paint)
    )
  )
}

/** Outlines the hovered layer in its outline colour, a section with its heavier stroke. */
export function outlineHoveredNode(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  preview?: RotationPreview | null
): void {
  r.auxStroke.setStrokeWidth((node.type === 'SECTION' ? SECTION_HOVER_STROKE_WIDTH : 1) / r.zoom)
  r.auxStroke.setColor(r.outlineColor(node, graph))
  r.auxStroke.setPathEffect(null)
  canvas.save()
  canvas.concat(r.sceneGeometry(graph, preview).screenMatrix(node, r))
  strokeNodeShape(r, canvas, node, r.auxStroke)
  canvas.restore()
}
