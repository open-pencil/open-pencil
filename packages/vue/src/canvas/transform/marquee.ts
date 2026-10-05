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

  const scopeId = d.containerId ?? editor.state.enteredContainerId
  const localMin = scopeId ? canvasToLocal(minX, minY, scopeId) : { lx: minX, ly: minY }
  const localMax = scopeId ? canvasToLocal(maxX, maxY, scopeId) : { lx: maxX, ly: maxY }
  const localMinX = Math.min(localMin.lx, localMax.lx)
  const localMinY = Math.min(localMin.ly, localMax.ly)
  const localMaxX = Math.max(localMin.lx, localMax.lx)
  const localMaxY = Math.max(localMin.ly, localMax.ly)

  const hits: string[] = []
  for (const node of editor.graph.getChildren(scopeId ?? editor.state.currentPageId)) {
    if (!node.visible || node.locked) continue
    // As in Figma, on the page a frame or section holding layers needs to be fully enclosed.
    const enclose = !scopeId && editor.graph.isOpenContainer(node.id)
    const hit = enclose
      ? node.x >= localMinX &&
        node.x + node.width <= localMaxX &&
        node.y >= localMinY &&
        node.y + node.height <= localMaxY
      : node.x + node.width > localMinX &&
        node.x < localMaxX &&
        node.y + node.height > localMinY &&
        node.y < localMaxY
    if (hit) hits.push(node.id)
  }

  editor.select(hits)
  editor.setMarquee({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
}
