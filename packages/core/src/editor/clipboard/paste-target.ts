import type { EditorContext } from '#core/editor/types'
import { CONTAINER_TYPES } from '#core/scene-graph/node-defaults'

export function resolvePasteTarget(ctx: EditorContext): string {
  if (ctx.state.enteredContainerId) return ctx.state.enteredContainerId
  const ids = [...ctx.state.selectedIds]
  if (ids.length !== 1) return ctx.state.currentPageId
  const node = ctx.graph.getNode(ids[0])
  if (!node) return ctx.state.currentPageId
  if (CONTAINER_TYPES.has(node.type) && node.type !== 'CANVAS') return node.id
  return node.parentId ?? ctx.state.currentPageId
}
