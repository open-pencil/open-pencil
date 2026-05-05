import type { Editor } from '@open-pencil/core/editor'

import type { DragState } from '#vue/shared/input/types'

type DragOriginal = { x: number; y: number; parentId: string }

export function duplicateAndDrag(
  cx: number,
  cy: number,
  editor: Editor
): { originals: Map<string, DragOriginal>; drag: DragState } {
  const previousSelection = new Set(editor.state.selectedIds)
  const newIds: string[] = []
  const newOriginals = new Map<string, DragOriginal>()
  for (const id of previousSelection) {
    const source = editor.graph.getNode(id)
    if (!source) continue
    const parentId = source.parentId ?? editor.state.currentPageId
    const clone = editor.graph.cloneTree(id, parentId, { name: source.name + ' copy' })
    if (!clone) continue
    newIds.push(clone.id)
    newOriginals.set(clone.id, {
      x: source.x,
      y: source.y,
      parentId
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
      currentX: cx,
      currentY: cy,
      originals: newOriginals,
      duplicated: true,
      duplicatedPreviousSelection: previousSelection
    }
  }
}
