import type { Editor } from '@open-pencil/core'
import {
  AUTO_LAYOUT_HOVER_GAP_REGION_TOLERANCE,
  AUTO_LAYOUT_HOVER_PADDING_REGION_TOLERANCE,
  AUTO_LAYOUT_HOVER_TICK_HIT_TOLERANCE
} from '@open-pencil/core/constants'
import type { SceneNode } from '@open-pencil/scene-graph'
import { isGeneratedFrame } from '@open-pencil/scene-graph/generated'
import type { Vector } from '@open-pencil/scene-graph/primitives'

type AutoLayoutHover = NonNullable<Editor['state']['autoLayoutHover']>

function visibleLayoutChildren(node: SceneNode, editor: Editor) {
  return node.childIds
    .map((id) => editor.graph.getNode(id))
    .filter(
      (child): child is SceneNode =>
        !!child && child.visible && child.layoutPositioning !== 'ABSOLUTE'
    )
}

function isNear(value: number, target: number, tolerance = AUTO_LAYOUT_HOVER_TICK_HIT_TOLERANCE) {
  return Math.abs(value - target) <= tolerance
}

function resolvePaddingHover(
  node: SceneNode,
  localX: number,
  localY: number
): AutoLayoutHover | null {
  const centerX = node.width / 2
  const centerY = node.height / 2

  if (node.paddingTop > 0) {
    const tickY = node.paddingTop / 2
    if (isNear(localX, centerX) && isNear(localY, tickY)) {
      return { nodeId: node.id, kind: 'padding-value', side: 'top' }
    }
    if (localY <= Math.min(node.paddingTop, AUTO_LAYOUT_HOVER_PADDING_REGION_TOLERANCE)) {
      return { nodeId: node.id, kind: 'padding', side: 'top' }
    }
  }

  if (node.paddingBottom > 0) {
    const tickY = node.height - node.paddingBottom / 2
    if (isNear(localX, centerX) && isNear(localY, tickY)) {
      return { nodeId: node.id, kind: 'padding-value', side: 'bottom' }
    }
    if (
      localY >=
      node.height - Math.min(node.paddingBottom, AUTO_LAYOUT_HOVER_PADDING_REGION_TOLERANCE)
    ) {
      return { nodeId: node.id, kind: 'padding', side: 'bottom' }
    }
  }

  if (node.paddingLeft > 0) {
    const tickX = node.paddingLeft / 2
    if (isNear(localX, tickX) && isNear(localY, centerY)) {
      return { nodeId: node.id, kind: 'padding-value', side: 'left' }
    }
    if (localX <= Math.min(node.paddingLeft, AUTO_LAYOUT_HOVER_PADDING_REGION_TOLERANCE)) {
      return { nodeId: node.id, kind: 'padding', side: 'left' }
    }
  }

  if (node.paddingRight > 0) {
    const tickX = node.width - node.paddingRight / 2
    if (isNear(localX, tickX) && isNear(localY, centerY)) {
      return { nodeId: node.id, kind: 'padding-value', side: 'right' }
    }
    if (
      localX >=
      node.width - Math.min(node.paddingRight, AUTO_LAYOUT_HOVER_PADDING_REGION_TOLERANCE)
    ) {
      return { nodeId: node.id, kind: 'padding', side: 'right' }
    }
  }

  return null
}

function resolveSpacingHover(
  node: SceneNode,
  children: SceneNode[],
  localX: number,
  localY: number
): AutoLayoutHover | null {
  if (children.length < 2 || node.itemSpacing <= 0) return null
  const isRow = node.layoutMode === 'HORIZONTAL'
  const contentCrossStart = isRow ? node.paddingTop : node.paddingLeft
  const contentCrossEnd = isRow ? node.height - node.paddingBottom : node.width - node.paddingRight
  const cross = isRow ? localY : localX
  if (cross < contentCrossStart || cross > contentCrossEnd) return null

  for (let i = 0; i < children.length - 1; i++) {
    const prev = children[i]
    const next = children[i + 1]
    const gapStart = isRow ? prev.x + prev.width : prev.y + prev.height
    const gapEnd = isRow ? next.x : next.y
    if (gapEnd < gapStart) continue

    const cursor = isRow ? localX : localY
    const tickMain = (gapStart + gapEnd) / 2
    const tickCross = (contentCrossStart + contentCrossEnd) / 2
    if (isNear(cursor, tickMain) && isNear(cross, tickCross)) {
      return { nodeId: node.id, kind: 'spacing-value', index: i }
    }
    if (
      cursor >= gapStart - AUTO_LAYOUT_HOVER_GAP_REGION_TOLERANCE &&
      cursor <= gapEnd + AUTO_LAYOUT_HOVER_GAP_REGION_TOLERANCE
    ) {
      return { nodeId: node.id, kind: 'spacing', index: i }
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

  const abs = editor.graph.getAbsolutePosition(node.id)
  const localX = cx - abs.x
  const localY = cy - abs.y
  if (localX < 0 || localY < 0 || localX > node.width || localY > node.height) return null

  const children = visibleLayoutChildren(node, editor)
  return (
    resolveSpacingHover(node, children, localX, localY) ??
    resolvePaddingHover(node, localX, localY) ??
    resolveChildrenHover(node, children, localX, localY) ?? { nodeId: node.id, kind: 'frame' }
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

/** The value a hover over a padding or a gap edits, as Figma opens it on a double-click. */
export function autoLayoutValueField(hover: AutoLayoutHover): AutoLayoutValueField | null {
  if ((hover.kind === 'padding' || hover.kind === 'padding-value') && hover.side)
    return PADDING_FIELDS[hover.side]
  if (hover.kind === 'spacing' || hover.kind === 'spacing-value') return 'itemSpacing'
  return null
}

/**
 * Where the editor for a value sits, in canvas coordinates: the middle of the padding, or of
 * the gap a double-click opened, as the hover draws its tick.
 */
export function autoLayoutValueAnchor(
  editor: Editor,
  nodeId: string,
  field: AutoLayoutValueField,
  gap = 0
): Vector | null {
  const node = editor.graph.getNode(nodeId)
  if (!node) return null
  const abs = editor.graph.getAbsolutePosition(node.id)
  const middle = { x: abs.x + node.width / 2, y: abs.y + node.height / 2 }
  if (field === 'paddingTop') return { x: middle.x, y: abs.y + node.paddingTop / 2 }
  if (field === 'paddingBottom')
    return { x: middle.x, y: abs.y + node.height - node.paddingBottom / 2 }
  if (field === 'paddingLeft') return { x: abs.x + node.paddingLeft / 2, y: middle.y }
  if (field === 'paddingRight')
    return { x: abs.x + node.width - node.paddingRight / 2, y: middle.y }
  const children = visibleLayoutChildren(node, editor)
  const prev = children.at(gap)
  const next = children.at(gap + 1)
  if (!prev || !next) return middle
  // Across the flow, the middle of the content box, where the hover draws the gap's tick.
  if (node.layoutMode === 'HORIZONTAL') {
    const y = abs.y + (node.paddingTop + node.height - node.paddingBottom) / 2
    return { x: abs.x + (prev.x + prev.width + next.x) / 2, y }
  }
  const x = abs.x + (node.paddingLeft + node.width - node.paddingRight) / 2
  return { x, y: abs.y + (prev.y + prev.height + next.y) / 2 }
}
