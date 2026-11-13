import { invert } from 'es-toolkit'

import type { Editor } from '@open-pencil/core'
import {
  AUTO_LAYOUT_HOVER_GAP_REGION_TOLERANCE,
  AUTO_LAYOUT_HOVER_PADDING_REGION_TOLERANCE,
  AUTO_LAYOUT_HOVER_TICK_HIT_TOLERANCE
} from '@open-pencil/core/constants'
import { createSceneGeometry } from '@open-pencil/core/geometry'
import {
  flowChildren,
  flowGaps,
  gapTick,
  paddingOf,
  paddingTick,
  type FlowGap,
  type PaddingSide
} from '@open-pencil/core/layout'
import type { SceneNode } from '@open-pencil/scene-graph'
import { isGeneratedFrame } from '@open-pencil/scene-graph/generated'
import type { Vector } from '@open-pencil/scene-graph/primitives'

type AutoLayoutHover = NonNullable<Editor['state']['autoLayoutHover']>

function isNear(value: number, target: number, tolerance = AUTO_LAYOUT_HOVER_TICK_HIT_TOLERANCE) {
  return Math.abs(value - target) <= tolerance
}

function isNearTick(point: Vector, tick: Vector) {
  return isNear(point.x, tick.x) && isNear(point.y, tick.y)
}

/** Whether `point` is in the band along `side`, at most the region tolerance deep. */
function inPaddingBand(node: SceneNode, side: PaddingSide, point: Vector) {
  const depth = Math.min(paddingOf(node, side), AUTO_LAYOUT_HOVER_PADDING_REGION_TOLERANCE)
  if (side === 'top') return point.y <= depth
  if (side === 'bottom') return point.y >= node.height - depth
  if (side === 'left') return point.x <= depth
  return point.x >= node.width - depth
}

/** Paddings in the order a point near two of them picks one. */
const HIT_ORDER: readonly PaddingSide[] = ['top', 'bottom', 'left', 'right']

function resolvePaddingHover(node: SceneNode, point: Vector): AutoLayoutHover | null {
  for (const side of HIT_ORDER) {
    if (paddingOf(node, side) <= 0) continue
    if (isNearTick(point, paddingTick(node, side))) {
      return { nodeId: node.id, kind: 'padding-value', side }
    }
    if (inPaddingBand(node, side, point)) return { nodeId: node.id, kind: 'padding', side }
  }
  return null
}

function resolveSpacingHover(
  node: SceneNode,
  gaps: readonly FlowGap[],
  point: Vector
): AutoLayoutHover | null {
  const isRow = node.layoutMode === 'HORIZONTAL'
  for (const { index, rect, tick } of gaps) {
    const cross = isRow ? point.y : point.x
    const crossStart = isRow ? rect.y : rect.x
    const crossEnd = crossStart + (isRow ? rect.height : rect.width)
    if (cross < crossStart || cross > crossEnd) return null
    if (isNearTick(point, tick)) return { nodeId: node.id, kind: 'spacing-value', index }
    const cursor = isRow ? point.x : point.y
    const start = isRow ? rect.x : rect.y
    const end = start + (isRow ? rect.width : rect.height)
    if (
      cursor >= start - AUTO_LAYOUT_HOVER_GAP_REGION_TOLERANCE &&
      cursor <= end + AUTO_LAYOUT_HOVER_GAP_REGION_TOLERANCE
    ) {
      return { nodeId: node.id, kind: 'spacing', index }
    }
  }
  return null
}

function resolveChildrenHover(
  node: SceneNode,
  children: SceneNode[],
  localX: number,
  localY: number
): AutoLayoutHover | null {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (
      localX >= child.x &&
      localX <= child.x + child.width &&
      localY >= child.y &&
      localY <= child.y + child.height
    ) {
      return { nodeId: node.id, kind: 'children', index: i }
    }
  }
  return null
}

export function resolveAutoLayoutHover(
  cx: number,
  cy: number,
  editor: Editor
): AutoLayoutHover | null {
  if (editor.state.selectedIds.size !== 1) return null
  const nodeId = [...editor.state.selectedIds][0]
  const node = editor.graph.getNode(nodeId)
  if (!node || (node.layoutMode !== 'HORIZONTAL' && node.layoutMode !== 'VERTICAL')) return null
  // A generated frame, such as a sticky note, lays itself out; its spacing is not the user's.
  if (isGeneratedFrame(node)) return null

  const geometry = createSceneGeometry(editor.graph, editor.state.rotationPreview)
  const point = geometry.toLocal(node, { x: cx, y: cy })
  if (!point || point.x < 0 || point.y < 0 || point.x > node.width || point.y > node.height) {
    return null
  }

  return (
    resolveSpacingHover(node, flowGaps(node, editor.graph), point) ??
    resolvePaddingHover(node, point) ??
    resolveChildrenHover(node, flowChildren(node, editor.graph), point.x, point.y) ?? {
      nodeId: node.id,
      kind: 'frame'
    }
  )
}

/** An auto layout frame's value the canvas edits in place: a padding or the gap. */
export type AutoLayoutValueField =
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'itemSpacing'

const PADDING_FIELDS = {
  top: 'paddingTop',
  right: 'paddingRight',
  bottom: 'paddingBottom',
  left: 'paddingLeft'
} as const satisfies Record<NonNullable<AutoLayoutHover['side']>, AutoLayoutValueField>

const PADDING_SIDES_BY_FIELD = invert(PADDING_FIELDS)

/** The value a hover over a padding or a gap edits, as Figma opens it on a double-click. */
export function autoLayoutValueField(hover: AutoLayoutHover): AutoLayoutValueField | null {
  if ((hover.kind === 'padding' || hover.kind === 'padding-value') && hover.side)
    return PADDING_FIELDS[hover.side]
  if (hover.kind === 'spacing' || hover.kind === 'spacing-value') return 'itemSpacing'
  return null
}

/**
 * Where the editor for a value sits, in canvas coordinates: on the tick the hover draws for the
 * padding, or for the gap a double-click opened.
 */
export function autoLayoutValueAnchor(
  editor: Editor,
  nodeId: string,
  field: AutoLayoutValueField,
  gap = 0
): Vector | null {
  const node = editor.graph.getNode(nodeId)
  if (!node) return null
  const geometry = createSceneGeometry(editor.graph, editor.state.rotationPreview)
  const side = field === 'itemSpacing' ? undefined : PADDING_SIDES_BY_FIELD[field]
  if (side) return geometry.toWorld(node, paddingTick(node, side))
  const tick = gapTick(node, editor.graph, gap) ?? { x: node.width / 2, y: node.height / 2 }
  return geometry.toWorld(node, tick)
}
