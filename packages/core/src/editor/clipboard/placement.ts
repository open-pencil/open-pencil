import { computeBounds } from '#core/geometry'

import type { EditorContext } from '#core/editor/types'

export function createClipboardPlacementActions(ctx: EditorContext) {
  function centerNodesAt(nodeIds: string[], cx: number, cy: number) {
    const items = nodeIds.map((id) => ctx.graph.getNode(id)).filter((node) => node != null)
    const bounds = computeBounds(items)
    if (bounds.width === 0 && bounds.height === 0 && items.length === 0) return
    const dx = cx - (bounds.x + bounds.width / 2)
    const dy = cy - (bounds.y + bounds.height / 2)
    for (const id of nodeIds) {
      const node = ctx.graph.getNode(id)
      if (node) ctx.graph.updateNode(id, { x: node.x + dx, y: node.y + dy })
    }
  }

  return { centerNodesAt }
}
