import type { Editor } from '@open-pencil/core/editor'

import type { DragMarquee } from '#vue/shared/input/types'

type CanvasToLocal = (cx: number, cy: number, scopeId: string) => { lx: number; ly: number }

export function handleMarqueeMove(
  editor: Editor,
  canvasToLocal: CanvasToLocal,
  d: DragMarquee,
  cx: number,
  cy: number
) {
  const minX = Math.min(d.startX, cx)
  const minY = Math.min(d.startY, cy)
  const maxX = Math.max(d.startX, cx)
  const maxY = Math.max(d.startY, cy)

  const scopeId = editor.state.enteredContainerId
  const parentId = scopeId ?? editor.state.currentPageId
  const localMin = scopeId ? canvasToLocal(minX, minY, scopeId) : { lx: minX, ly: minY }
  const localMax = scopeId ? canvasToLocal(maxX, maxY, scopeId) : { lx: maxX, ly: maxY }
  const localMinX = Math.min(localMin.lx, localMax.lx)
  const localMinY = Math.min(localMin.ly, localMax.ly)
  const localMaxX = Math.max(localMin.lx, localMax.lx)
  const localMaxY = Math.max(localMin.ly, localMax.ly)

  const hits: string[] = []
  for (const node of editor.graph.getChildren(parentId)) {
    if (!node.visible || node.locked) continue
    if (
      node.x + node.width > localMinX &&
      node.x < localMaxX &&
      node.y + node.height > localMinY &&
      node.y < localMaxY
    ) {
      hits.push(node.id)
    }
  }

  editor.select(hits)
  editor.setMarquee({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
}
