import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/core/scene-graph'

export function findMoveDropTarget(cx: number, cy: number, editor: Editor): SceneNode | null {
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

export function reparentOutsideNodes(editor: Editor) {
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
