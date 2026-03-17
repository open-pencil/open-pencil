import { AUTO_LAYOUT_BREAK_THRESHOLD, computeSelectionBounds, computeSnap } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/core'
import type { Editor } from '@open-pencil/core/editor'

import type { DragMove, DragState } from './types'
import { computeAutoLayoutIndicator, computeAutoLayoutIndicatorForFrame } from './auto-layout'

export function detectAutoLayoutParent(editor: Editor): string | undefined {
  if (editor.state.selectedIds.size !== 1) return undefined
  const selectedId = [...editor.state.selectedIds][0]
  const selectedNode = editor.graph.getNode(selectedId)
  if (!selectedNode?.parentId) return undefined
  const parent = editor.graph.getNode(selectedNode.parentId)
  if (parent && parent.layoutMode !== 'NONE' && selectedNode.layoutPositioning !== 'ABSOLUTE') {
    return parent.id
  }
  return undefined
}

export function duplicateAndDrag(
  cx: number,
  cy: number,
  editor: Editor
): { originals: Map<string, { x: number; y: number; parentId: string }>; drag: DragState } {
  const newIds: string[] = []
  const newOriginals = new Map<string, { x: number; y: number; parentId: string }>()
  for (const id of editor.state.selectedIds) {
    const src = editor.graph.getNode(id)
    if (!src) continue
    const newId = editor.createShape(src.type, src.x, src.y, src.width, src.height)
    editor.graph.updateNode(newId, {
      name: src.name + ' copy',
      fills: [...src.fills],
      strokes: [...src.strokes],
      effects: [...src.effects],
      cornerRadius: src.cornerRadius,
      opacity: src.opacity,
      rotation: src.rotation
    })
    newIds.push(newId)
    const newNode = editor.graph.getNode(newId)
    newOriginals.set(newId, {
      x: src.x,
      y: src.y,
      parentId: newNode?.parentId ?? editor.state.currentPageId
    })
  }
  editor.select(newIds)
  editor.requestRender()
  return {
    originals: newOriginals,
    drag: {
      type: 'move',
      startX: cx,
      startY: cy,
      originals: newOriginals,
      duplicated: true
    }
  }
}

function findDropTarget(cx: number, cy: number, editor: Editor): SceneNode | null {
  let dropTarget = editor.graph.hitTestFrame(
    cx,
    cy,
    editor.state.selectedIds,
    editor.state.currentPageId
  )
  const movingSection = [...editor.state.selectedIds].some(
    (id) => editor.graph.getNode(id)?.type === 'SECTION'
  )
  if (
    movingSection &&
    dropTarget &&
    dropTarget.type !== 'SECTION' &&
    dropTarget.type !== 'CANVAS'
  ) {
    dropTarget = null
  }
  return dropTarget
}

function applyMoveSnap(
  d: DragMove,
  dx: number,
  dy: number,
  editor: Editor
): { dx: number; dy: number } {
  const selectedNodes: SceneNode[] = []
  for (const [id, orig] of d.originals) {
    const n = editor.graph.getNode(id)
    if (n) {
      const abs = editor.graph.getAbsolutePosition(id)
      const parentAbs = n.parentId ? editor.graph.getAbsolutePosition(n.parentId) : { x: 0, y: 0 }
      selectedNodes.push({
        ...n,
        x: abs.x - parentAbs.x - n.x + orig.x + dx,
        y: abs.y - parentAbs.y - n.y + orig.y + dy
      })
    }
  }

  const bounds = computeSelectionBounds(selectedNodes)
  if (!bounds) return { dx, dy }

  const firstId = [...d.originals.keys()][0]
  const firstNode = editor.graph.getNode(firstId)
  const parentId = firstNode?.parentId ?? editor.state.currentPageId
  const siblings = editor.graph.getChildren(parentId)
  const parentAbs = !editor.isTopLevel(parentId)
    ? editor.graph.getAbsolutePosition(parentId)
    : { x: 0, y: 0 }
  const absTargets = siblings.map((n) => ({
    ...n,
    x: n.x + parentAbs.x,
    y: n.y + parentAbs.y
  }))
  const absBounds = {
    x: bounds.x + parentAbs.x,
    y: bounds.y + parentAbs.y,
    width: bounds.width,
    height: bounds.height
  }
  const snap = computeSnap(editor.state.selectedIds, absBounds, absTargets)
  editor.setSnapGuides(snap.guides)
  return { dx: dx + snap.dx, dy: dy + snap.dy }
}

export function handleMoveMove(d: DragMove, cx: number, cy: number, editor: Editor) {
  let dx = cx - d.startX
  let dy = cy - d.startY

  if (d.autoLayoutParentId && !d.brokeFromAutoLayout) {
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < AUTO_LAYOUT_BREAK_THRESHOLD) {
      computeAutoLayoutIndicator(d, cx, cy, editor)
      return
    }
    d.brokeFromAutoLayout = true
    editor.setLayoutInsertIndicator(null)
  }

  const dropTarget = findDropTarget(cx, cy, editor)
  const dropParent = dropTarget ? editor.graph.getNode(dropTarget.id) : null

  if (dropParent && dropParent.layoutMode !== 'NONE') {
    computeAutoLayoutIndicatorForFrame(dropParent, cx, cy, editor)
    editor.setDropTarget(dropParent.id)
    for (const [id, orig] of d.originals) {
      editor.graph.updateNode(id, {
        x: Math.round(orig.x + dx),
        y: Math.round(orig.y + dy)
      })
    }
    editor.requestRender()
    return
  }

  editor.setLayoutInsertIndicator(null)

  const snapped = applyMoveSnap(d, dx, dy, editor)
  dx = snapped.dx
  dy = snapped.dy

  for (const [id, orig] of d.originals) {
    editor.updateNode(id, { x: Math.round(orig.x + dx), y: Math.round(orig.y + dy) })
  }

  editor.setDropTarget(dropTarget?.id ?? null)
}

function reparentOutsideNodes(editor: Editor) {
  for (const id of editor.state.selectedIds) {
    const node = editor.graph.getNode(id)
    if (!node?.parentId || editor.isTopLevel(node.parentId)) continue
    const parent = editor.graph.getNode(node.parentId)
    if (!parent || (parent.type !== 'FRAME' && parent.type !== 'SECTION')) continue
    const outsideX = node.x + node.width < 0 || node.x > parent.width
    const outsideY = node.y + node.height < 0 || node.y > parent.height
    if (outsideX || outsideY) {
      const grandparentId = parent.parentId ?? editor.state.currentPageId
      editor.graph.reparentNode(id, grandparentId)
    }
  }
}

export function handleMoveUp(d: DragMove, editor: Editor) {
  const indicator = editor.state.layoutInsertIndicator
  editor.setLayoutInsertIndicator(null)
  editor.setSnapGuides([])

  if (indicator) {
    for (const id of editor.state.selectedIds) {
      editor.reorderInAutoLayout(id, indicator.parentId, indicator.index)
    }
    editor.setDropTarget(null)
    return
  }

  const moved = [...d.originals].some(([id, orig]) => {
    const node = editor.graph.getNode(id)
    return node && (node.x !== orig.x || node.y !== orig.y)
  })

  if (moved) {
    const dropId = editor.state.dropTargetId
    if (dropId) {
      editor.reparentNodes([...editor.state.selectedIds], dropId)
    } else {
      reparentOutsideNodes(editor)
    }
    editor.commitMoveWithReparent(d.originals)
  }
  editor.setDropTarget(null)
}
