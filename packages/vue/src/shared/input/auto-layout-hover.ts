import {
  AUTO_LAYOUT_HOVER_GAP_REGION_TOLERANCE,
  AUTO_LAYOUT_HOVER_PADDING_REGION_TOLERANCE,
  AUTO_LAYOUT_HOVER_TICK_HIT_TOLERANCE
} from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/core/scene-graph'

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

function resolvePaddingHover(node: SceneNode, localX: number, localY: number): AutoLayoutHover | null {
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
    if (localY >= node.height - Math.min(node.paddingBottom, AUTO_LAYOUT_HOVER_PADDING_REGION_TOLERANCE)) {
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
    if (localX >= node.width - Math.min(node.paddingRight, AUTO_LAYOUT_HOVER_PADDING_REGION_TOLERANCE)) {
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

export function resolveAutoLayoutHover(cx: number, cy: number, editor: Editor): AutoLayoutHover | null {
  if (editor.state.selectedIds.size !== 1) return null
  const nodeId = [...editor.state.selectedIds][0]
  const node = editor.graph.getNode(nodeId)
  if (!node || (node.layoutMode !== 'HORIZONTAL' && node.layoutMode !== 'VERTICAL')) return null

  const abs = editor.graph.getAbsolutePosition(node.id)
  const localX = cx - abs.x
  const localY = cy - abs.y
  if (localX < 0 || localY < 0 || localX > node.width || localY > node.height) return null

  const children = visibleLayoutChildren(node, editor)
  return (
    resolveSpacingHover(node, children, localX, localY) ??
    resolvePaddingHover(node, localX, localY) ??
    resolveChildrenHover(node, children, localX, localY) ??
    { nodeId: node.id, kind: 'frame' }
  )
}
