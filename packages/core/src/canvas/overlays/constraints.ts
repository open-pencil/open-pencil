import type { Canvas, Paint } from 'canvaskit-wasm'

import type { ConstraintType, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedBoundsInParent } from '@open-pencil/scene-graph/coordinate'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import { isConstraintEligible } from '@open-pencil/scene-graph/resize'

import type { SkiaRenderer } from '#core/canvas/renderer'
import type { RotationPreview } from '#core/geometry'

import { inNodeSpace, withScreenStroke } from './outline'

/** Dash and gap of an indicator line, in screen pixels. */
const INDICATOR_DASH = [4, 4] as const
/** How far a Center indicator reaches each way from the layer's centre, in screen pixels. */
const CENTER_REACH = 6

type Segment = readonly [x1: number, y1: number, x2: number, y2: number]

/** The indicator lines of one axis, given the layer's box and its parent's extent on that axis. */
function axisSegments(
  constraint: ConstraintType,
  start: number,
  end: number,
  extent: number,
  reach: number
): (readonly [from: number, to: number])[] {
  const segments: (readonly [number, number])[] = []
  if (constraint === 'MIN' || constraint === 'STRETCH') segments.push([0, start])
  if (constraint === 'MAX' || constraint === 'STRETCH') segments.push([end, extent])
  if (constraint === 'CENTER') {
    const middle = (start + end) / 2
    segments.push([middle - reach, middle + reach])
  }
  return segments
}

/** Every indicator line of `box` in a parent of `width` × `height`, in the parent's space. */
export function constraintSegments(
  box: Rect,
  parent: Pick<SceneNode, 'width' | 'height'>,
  horizontal: ConstraintType,
  vertical: ConstraintType,
  centerReach: number
): Segment[] {
  const midX = box.x + box.width / 2
  const midY = box.y + box.height / 2
  const across = axisSegments(horizontal, box.x, box.x + box.width, parent.width, centerReach)
  const down = axisSegments(vertical, box.y, box.y + box.height, parent.height, centerReach)
  return [
    ...across.map(([from, to]): Segment => [from, midY, to, midY]),
    ...down.map(([from, to]): Segment => [midX, from, midX, to])
  ]
}

/**
 * A single selected layer's constraints as Figma shows them, in its parent's space: a dashed line
 * from the middle of each pinned side to the parent's matching edge (both for Left & Right or Top &
 * Bottom), a short one through the centre along a centred axis, and nothing for Scale. Only layers
 * whose constraints the Design panel offers have them.
 */
export function drawConstraintIndicators(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  preview?: RotationPreview | null
): void {
  if (!node.parentId || !isConstraintEligible(graph, node)) return
  const parent = graph.getNode(node.parentId)
  if (!parent) return
  const geometry = r.sceneGeometry(graph, preview)
  const projected = {
    rootId: graph.rootId,
    getNode: (id: string) => {
      const source = graph.getNode(id)
      return source ? geometry.node(source) : undefined
    }
  }
  const box = getAxisAlignedBoundsInParent([geometry.node(node)], parent.id, projected)
  const segments = constraintSegments(
    box,
    parent,
    node.horizontalConstraint,
    node.verticalConstraint,
    CENTER_REACH / r.zoom
  )
  if (segments.length === 0) return
  const stroke = { color: r.outlineColor(node, graph), dash: INDICATOR_DASH }
  inNodeSpace(r, canvas, geometry, parent, () =>
    withScreenStroke(r, stroke, (paint: Paint) => {
      for (const [x1, y1, x2, y2] of segments) canvas.drawLine(x1, y1, x2, y2, paint)
    })
  )
}
