import type { Editor } from '@inkly/core/editor'

import { useI18n } from '#vue/i18n/useI18n.js'
import type { DragOriginal } from '#vue/shared/input/drag-original'
import type { DragState } from '#vue/shared/input/types'

export function duplicateAndDrag(
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  editor: Editor
): { originals: Map<string, DragOriginal>; drag: DragState } {
  const previousSelection = new Set(editor.state.selectedIds)
  const { panels } = useI18n()
  const newIds: string[] = []
  const newOriginals = new Map<string, DragOriginal>()
  for (const id of previousSelection) {
    const source = editor.graph.getNode(id)
    if (!source) continue
    const parentId = source.parentId ?? editor.state.currentPageId
    const clone = editor.graph.cloneTree(id, parentId, {
      name: source.name + panels.value.nodeCopyString || ' copy'
    })
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
      startScreenX: sx,
      startScreenY: sy,
      dragStarted: true,
      originals: newOriginals,
      duplicated: true,
      duplicatedPreviousSelection: previousSelection
    }
  }
}
