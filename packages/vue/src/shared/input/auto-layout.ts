import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { resolveNodeLayoutDirection } from '@open-pencil/scene-graph/text-direction'

import type { DragMove } from '#vue/shared/input/types'

function resolveLayoutDirection(parent: SceneNode, editor: Editor): 'LTR' | 'RTL' {
  const ancestor = parent.parentId ? editor.graph.getNode(parent.parentId) : null
  const inheritedDirection = ancestor ? resolveLayoutDirection(ancestor, editor) : 'LTR'
  return resolveNodeLayoutDirection(parent, inheritedDirection)
}

function isRTLRow(parent: SceneNode, isRow: boolean, editor: Editor) {
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
  const rtlRow = isRTLRow(parent, isRow, editor)

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

export function filteredToRealIndex(
  parentId: string,
  insertIndex: number,
  editor: Editor,
  movingIds: ReadonlySet<string> = editor.state.selectedIds
): number {
  const allChildren = editor.graph.getChildren(parentId)
  let realIndex = 0
  let filteredCount = 0
  for (const child of allChildren) {
    if (movingIds.has(child.id)) continue
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

interface FlowLine {
  /** Index of the line's first child among the frame's flow children. */
  offset: number
  children: SceneNode[]
  crossStart: number
  crossEnd: number
}

/** Splits wrapped children into lines along the cross axis; one line when nothing wraps. */
function flowLines(parent: SceneNode, children: SceneNode[], isRow: boolean, editor: Editor) {
  const lines: FlowLine[] = []
  for (const [index, child] of children.entries()) {
    const abs = editor.graph.getAbsolutePosition(child.id)
    const start = isRow ? abs.y : abs.x
    const end = start + (isRow ? child.height : child.width)
    const line = parent.layoutWrap === 'WRAP' ? lines.at(-1) : lines[0]
    if (line && (parent.layoutWrap !== 'WRAP' || start < line.crossEnd)) {
      line.children.push(child)
      line.crossStart = Math.min(line.crossStart, start)
      line.crossEnd = Math.max(line.crossEnd, end)
    } else {
      lines.push({ offset: index, children: [child], crossStart: start, crossEnd: end })
    }
  }
  return lines
}

/** The wrapped line under the cursor, or the nearest one. */
function lineAt(lines: FlowLine[], cross: number): FlowLine | undefined {
  return lines.find((line, i) => {
    const next = lines.at(i + 1)
    return !next || cross < (line.crossEnd + next.crossStart) / 2
  })
}

function autoLayoutInsertion(
  parent: SceneNode,
  cx: number,
  cy: number,
  editor: Editor,
  movingIds: ReadonlySet<string>
) {
  const children = editor.graph
    .getChildren(parent.id)
    .filter((c) => c.layoutPositioning !== 'ABSOLUTE' && !movingIds.has(c.id))

  const isRow = parent.layoutMode === 'HORIZONTAL'
  const rtlRow = isRTLRow(parent, isRow, editor)
  const line = lineAt(flowLines(parent, children, isRow, editor), isRow ? cy : cx)
  const lineChildren = line?.children ?? []

  let lineIndex = lineChildren.length
  for (let i = 0; i < lineChildren.length; i++) {
    const childAbs = editor.graph.getAbsolutePosition(lineChildren[i].id)
    const mid = isRow
      ? childAbs.x + lineChildren[i].width / 2
      : childAbs.y + lineChildren[i].height / 2
    const cursor = isRow ? cx : cy
    const shouldInsertBefore = rtlRow ? cursor > mid : cursor < mid
    if (shouldInsertBefore) {
      lineIndex = i
      break
    }
  }

  const insertIndex = (line?.offset ?? 0) + lineIndex
  const realIndex = filteredToRealIndex(parent.id, insertIndex, editor, movingIds)
  return { line, lineIndex, realIndex, isRow }
}

/** Where layers dropped at the cursor go among an auto layout frame's children. */
export function autoLayoutInsertIndex(
  parent: SceneNode,
  cx: number,
  cy: number,
  editor: Editor,
  movingIds: ReadonlySet<string>
) {
  return autoLayoutInsertion(parent, cx, cy, editor, movingIds).realIndex
}

/** Where the indicator spans across the flow: the whole frame, or the wrapped line it joins. */
function indicatorCrossExtent(
  parent: SceneNode,
  parentAbs: Vector,
  isRow: boolean,
  line: FlowLine | undefined
) {
  if (parent.layoutWrap === 'WRAP' && line) {
    return { crossStart: line.crossStart, crossLength: line.crossEnd - line.crossStart }
  }
  if (isRow) {
    return {
      crossStart: parentAbs.y + parent.paddingTop,
      crossLength: parent.height - parent.paddingTop - parent.paddingBottom
    }
  }
  return {
    crossStart: parentAbs.x + parent.paddingLeft,
    crossLength: parent.width - parent.paddingLeft - parent.paddingRight
  }
}

export function computeAutoLayoutIndicatorForFrame(
  parent: SceneNode,
  cx: number,
  cy: number,
  editor: Editor,
  movingIds: ReadonlySet<string> = editor.state.selectedIds
) {
  const { line, lineIndex, realIndex, isRow } = autoLayoutInsertion(
    parent,
    cx,
    cy,
    editor,
    movingIds
  )
  const parentAbs = editor.graph.getAbsolutePosition(parent.id)
  if (movingIds.size === 1) {
    const movingId = [...movingIds][0]
    const movingNode = editor.graph.getNode(movingId)
    const currentIndex = parent.childIds.indexOf(movingId)
    if (movingNode?.parentId === parent.id && realIndex === currentIndex) {
      editor.setLayoutInsertIndicator(null)
      return
    }
  }

  const indicatorPos = computeIndicatorPosition(
    line?.children ?? [],
    lineIndex,
    parent,
    parentAbs,
    isRow,
    editor
  )
  const { crossStart, crossLength } = indicatorCrossExtent(parent, parentAbs, isRow, line)

  editor.setLayoutInsertIndicator({
    parentId: parent.id,
    index: realIndex,
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
  computeAutoLayoutIndicatorForFrame(parent, cx, cy, editor, new Set(d.originals.keys()))
}
