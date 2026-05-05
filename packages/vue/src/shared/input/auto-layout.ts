import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/core/scene-graph'
import { resolveNodeLayoutDirection } from '@open-pencil/core/text'
import type { Vector } from '@open-pencil/core/types'

import type { DragMove } from '#vue/shared/input/types'

function resolveLayoutDirection(parent: SceneNode, editor: Editor): 'LTR' | 'RTL' {
  const ancestor = parent.parentId ? editor.graph.getNode(parent.parentId) : null
  const inheritedDirection = ancestor ? resolveLayoutDirection(ancestor, editor) : 'LTR'
  return resolveNodeLayoutDirection(parent, inheritedDirection)
}

function isRtlRow(parent: SceneNode, isRow: boolean, editor: Editor) {
  return isRow && resolveLayoutDirection(parent, editor) === 'RTL'
}

export function computeIndicatorPosition(
  children: SceneNode[],
  insertIndex: number,
  parent: SceneNode,
  parentAbs: Vector,
  isRow: boolean,
  editor: Editor
): number {
  const rtlRow = isRtlRow(parent, isRow, editor)

  if (children.length === 0) {
    if (isRow) {
      return rtlRow
        ? parentAbs.x + parent.width - parent.paddingRight
        : parentAbs.x + parent.paddingLeft
    }
    return parentAbs.y + parent.paddingTop
  }
  if (insertIndex === 0) {
    const firstAbs = editor.graph.getAbsolutePosition(children[0].id)
    if (isRow) {
      return rtlRow
        ? firstAbs.x + children[0].width + parent.itemSpacing / 2
        : firstAbs.x - parent.itemSpacing / 2
    }
    return firstAbs.y - parent.itemSpacing / 2
  }
  if (insertIndex >= children.length) {
    const last = children[children.length - 1]
    const lastAbs = editor.graph.getAbsolutePosition(last.id)
    if (isRow) {
      return rtlRow
        ? lastAbs.x - parent.itemSpacing / 2
        : lastAbs.x + last.width + parent.itemSpacing / 2
    }
    return lastAbs.y + last.height + parent.itemSpacing / 2
  }
  const prev = children[insertIndex - 1]
  const next = children[insertIndex]
  const prevAbs = editor.graph.getAbsolutePosition(prev.id)
  const nextAbs = editor.graph.getAbsolutePosition(next.id)
  if (isRow) {
    return rtlRow
      ? (prevAbs.x + nextAbs.x + next.width) / 2
      : (prevAbs.x + prev.width + nextAbs.x) / 2
  }
  return (prevAbs.y + prev.height + nextAbs.y) / 2
}

export function filteredToRealIndex(parentId: string, insertIndex: number, editor: Editor): number {
  const allChildren = editor.graph.getChildren(parentId)
  let realIndex = 0
  let filteredCount = 0
  for (const child of allChildren) {
    if (editor.state.selectedIds.has(child.id)) continue
    if (child.layoutPositioning === 'ABSOLUTE') {
      realIndex++
      continue
    }
    if (filteredCount === insertIndex) break
    filteredCount++
    realIndex++
  }
  return realIndex
}

export function computeAutoLayoutIndicatorForFrame(
  parent: SceneNode,
  cx: number,
  cy: number,
  editor: Editor
) {
  const children = editor.graph
    .getChildren(parent.id)
    .filter((c) => c.layoutPositioning !== 'ABSOLUTE' && !editor.state.selectedIds.has(c.id))

  const parentAbs = editor.graph.getAbsolutePosition(parent.id)
  const isRow = parent.layoutMode === 'HORIZONTAL'
  const rtlRow = isRtlRow(parent, isRow, editor)

  let insertIndex = children.length
  for (let i = 0; i < children.length; i++) {
    const childAbs = editor.graph.getAbsolutePosition(children[i].id)
    const mid = isRow ? childAbs.x + children[i].width / 2 : childAbs.y + children[i].height / 2
    const cursor = isRow ? cx : cy
    const shouldInsertBefore = rtlRow ? cursor > mid : cursor < mid
    if (shouldInsertBefore) {
      insertIndex = i
      break
    }
  }

  const indicatorPos = computeIndicatorPosition(
    children,
    insertIndex,
    parent,
    parentAbs,
    isRow,
    editor
  )
  const crossStart = isRow ? parentAbs.y + parent.paddingTop : parentAbs.x + parent.paddingLeft
  const crossLength = isRow
    ? parent.height - parent.paddingTop - parent.paddingBottom
    : parent.width - parent.paddingLeft - parent.paddingRight

  editor.setLayoutInsertIndicator({
    parentId: parent.id,
    index: filteredToRealIndex(parent.id, insertIndex, editor),
    x: isRow ? indicatorPos : crossStart,
    y: isRow ? crossStart : indicatorPos,
    length: crossLength,
    direction: isRow ? 'VERTICAL' : 'HORIZONTAL'
  })
}

export function computeAutoLayoutIndicator(d: DragMove, cx: number, cy: number, editor: Editor) {
  if (!d.autoLayoutParentId) return
  const parent = editor.graph.getNode(d.autoLayoutParentId)
  if (!parent || parent.layoutMode === 'NONE') return
  computeAutoLayoutIndicatorForFrame(parent, cx, cy, editor)
}
