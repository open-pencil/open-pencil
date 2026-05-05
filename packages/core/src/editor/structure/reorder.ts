import type { EditorContext } from '#core/editor/types'
import { computeLayout } from '#core/layout'

export function createStructureReorderActions(ctx: EditorContext) {
  function doReorderChild(nodeId: string, parentId: string, insertIndex: number) {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return

    if (node.parentId !== parentId) {
      const absPos = ctx.graph.getAbsolutePosition(nodeId)
      const parentAbs = ctx.graph.getAbsolutePosition(parentId)
      ctx.graph.updateNode(nodeId, { x: absPos.x - parentAbs.x, y: absPos.y - parentAbs.y })
    }

    ctx.graph.reorderChild(nodeId, parentId, insertIndex)
    computeLayout(ctx.graph, parentId)
    ctx.runLayoutForNode(parentId)
  }

  function reorderInAutoLayout(nodeId: string, parentId: string, insertIndex: number) {
    const parent = ctx.graph.getNode(parentId)
    if (!parent || parent.layoutMode === 'NONE') return

    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const origParentId = node.parentId ?? ctx.state.currentPageId
    const origX = node.x
    const origY = node.y
    const origIndex = ctx.graph.getNode(origParentId)?.childIds.indexOf(nodeId) ?? -1

    doReorderChild(nodeId, parentId, insertIndex)

    ctx.undo.push({
      label: 'Reorder',
      forward: () => {
        doReorderChild(nodeId, parentId, insertIndex)
      },
      inverse: () => {
        ctx.graph.reorderChild(nodeId, origParentId, origIndex >= 0 ? origIndex : 0)
        ctx.graph.updateNode(nodeId, { x: origX, y: origY })
        computeLayout(ctx.graph, origParentId)
        ctx.runLayoutForNode(origParentId)
        if (origParentId !== parentId) {
          computeLayout(ctx.graph, parentId)
          ctx.runLayoutForNode(parentId)
        }
      }
    })
  }

  function reorderChildWithUndo(nodeId: string, newParentId: string, insertIndex: number) {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    const origParentId = node.parentId ?? ctx.state.currentPageId
    const origIndex = ctx.graph.getNode(origParentId)?.childIds.indexOf(nodeId) ?? 0
    const origX = node.x
    const origY = node.y

    ctx.graph.reorderChild(nodeId, newParentId, insertIndex)
    ctx.runLayoutForNode(newParentId)
    if (origParentId !== newParentId) ctx.runLayoutForNode(origParentId)

    ctx.undo.push({
      label: 'Reorder',
      forward: () => {
        ctx.graph.reorderChild(nodeId, newParentId, insertIndex)
        ctx.runLayoutForNode(newParentId)
        if (origParentId !== newParentId) ctx.runLayoutForNode(origParentId)
      },
      inverse: () => {
        ctx.graph.reorderChild(nodeId, origParentId, origIndex)
        ctx.graph.updateNode(nodeId, { x: origX, y: origY })
        ctx.runLayoutForNode(origParentId)
        if (origParentId !== newParentId) ctx.runLayoutForNode(newParentId)
      }
    })
  }

  function moveSelectionInZOrder(
    isAlreadyPlaced: (currentIndex: number, childCount: number) => boolean,
    insertIndex: (childCount: number) => number
  ) {
    for (const id of ctx.state.selectedIds) {
      const node = ctx.graph.getNode(id)
      if (!node?.parentId) continue
      const parent = ctx.graph.getNode(node.parentId)
      if (!parent) continue
      if (isAlreadyPlaced(parent.childIds.indexOf(id), parent.childIds.length)) continue
      ctx.graph.insertChildAt(id, node.parentId, insertIndex(parent.childIds.length))
    }
    ctx.requestRender()
  }

  function bringToFront() {
    moveSelectionInZOrder(
      (currentIndex, childCount) => currentIndex === childCount - 1,
      (childCount) => childCount
    )
  }

  function sendToBack() {
    moveSelectionInZOrder(
      (currentIndex) => currentIndex === 0,
      () => 0
    )
  }

  return { reorderInAutoLayout, reorderChildWithUndo, bringToFront, sendToBack }
}
