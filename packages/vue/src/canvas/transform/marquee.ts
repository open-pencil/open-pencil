import type { Editor } from '@open-pencil/core/editor'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import type { DragMarquee } from '#vue/shared/input/types'

function intersects(a: Rect, b: Rect) {
  return a.x + a.width > b.x && a.x < b.x + b.width && a.y + a.height > b.y && a.y < b.y + b.height
}

function encloses(outer: Rect, inner: Rect) {
  return (
    inner.x >= outer.x &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y >= outer.y &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

export function handleMarqueeMove(editor: Editor, d: DragMarquee, cx: number, cy: number) {
  const marquee = {
    x: Math.min(d.startX, cx),
    y: Math.min(d.startY, cy),
    width: Math.abs(cx - d.startX),
    height: Math.abs(cy - d.startY)
  }

  // Layers are compared by their canvas bounds, so rotated layers and containers match what is drawn.
  const scopeId = d.containerId ?? editor.state.enteredContainerId
  const hits: string[] = []
  for (const node of editor.graph.getChildren(scopeId ?? editor.state.currentPageId)) {
    if (!node.visible || node.locked) continue
    const bounds = getAxisAlignedWorldBounds(node, editor.graph)
    // As in Figma, on the page a frame or section holding layers needs to be fully enclosed.
    const enclose = !scopeId && editor.graph.isOpenContainer(node.id)
    if (enclose ? encloses(marquee, bounds) : intersects(marquee, bounds)) hits.push(node.id)
  }

  editor.select(hits)
  editor.setMarquee(marquee)
}
