import type { Canvas, Paint } from 'canvaskit-wasm'

import type { ConstraintType, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  constraintFrame,
  constraintLayers,
  sharedConstraint
} from '@open-pencil/scene-graph/constraints'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas/renderer'
import type { RotationPreview } from '#core/geometry'

import { inNodeSpace, withScreenStroke } from './outline'

/** Dash and gap of an indicator line in screen pixels, as Figma draws them (live, #1835). */
const INDICATOR_DASH = [2.5, 1.5] as const

type Segment = readonly [x1: number, y1: number, x2: number, y2: number]

/** The indicator lines of one axis, given the layer's span and its parent's extent on that axis. */
function axisSegments(
  constraint: ConstraintType | null,
  start: number,
  end: number,
  extent: number
): (readonly [from: number, to: number])[] {
  const segments: (readonly [number, number])[] = []
  if (constraint === 'MIN' || constraint === 'STRETCH') segments.push([0, start])
  if (constraint === 'MAX' || constraint === 'STRETCH') segments.push([end, extent])
  if (constraint === 'CENTER') {
    const quarter = (end - start) / 4
    segments.push([start + quarter, end - quarter])
  }
  return segments
}

/**
 * Every indicator line of `box` in a frame of `width` × `height`, in the frame's space; an axis
 * whose layers differ, given as null, has none.
 */
export function constraintSegments(
  box: Rect,
  parent: Pick<SceneNode, 'width' | 'height'>,
  horizontal: ConstraintType | null,
  vertical: ConstraintType | null
): Segment[] {
  const midX = box.x + box.width / 2
  const midY = box.y + box.height / 2
  const across = axisSegments(horizontal, box.x, box.x + box.width, parent.width)
  const down = axisSegments(vertical, box.y, box.y + box.height, parent.height)
  return [
    ...across.map(([from, to]): Segment => [from, midY, to, midY]),
    ...down.map(([from, to]): Segment => [midX, from, midX, to])
  ]
}

/**
 * A single selected layer's constraints as Figma shows them, in its frame's space: a dashed line
 * from the middle of each pinned side to the frame's matching edge (both for Left & Right or Top &
 * Bottom), one across the middle half of the layer along a centred axis, and nothing for Scale.
 * A layer in groups pins to the frame around them; a group or boolean shows the constraints its
 * layers share, from its own box, as in Figma (live, #1835).
 */
export function drawConstraintIndicators(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  preview?: RotationPreview | null
): void {
  const frame = constraintFrame(graph, node)
  if (!frame) return
  const layers = constraintLayers(graph, node)
  const geometry = r.sceneGeometry(graph, preview)
  const box = geometry.boundsInParent(node, frame.id)
  const segments = constraintSegments(
    box,
    frame,
    sharedConstraint(layers, 'horizontalConstraint'),
    sharedConstraint(layers, 'verticalConstraint')
  )
  if (segments.length === 0) return
  const stroke = { color: r.outlineColor(node, graph), dash: INDICATOR_DASH }
  inNodeSpace(r, canvas, geometry, frame, () =>
    withScreenStroke(r, stroke, (paint: Paint) => {
      for (const [x1, y1, x2, y2] of segments) canvas.drawLine(x1, y1, x2, y2, paint)
    })
  )
}
