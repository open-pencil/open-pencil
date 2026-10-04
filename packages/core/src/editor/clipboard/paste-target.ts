import { CONTAINER_TYPES } from '@open-pencil/scene-graph/node-defaults'

import { acceptingParent } from '#core/editor/components/slots'
import type { EditorContext } from '#core/editor/types'

/**
 * Where ordinary paste and file drops insert; replacement paste uses its target's parent.
 * Never the locked part of an instance, only its slots.
 */
export function resolvePasteTarget(ctx: Pick<EditorContext, 'graph' | 'state'>): string {
  return acceptingParent(ctx, pasteTargetCandidate(ctx))
}

function pasteTargetCandidate(ctx: Pick<EditorContext, 'graph' | 'state'>): string {
  if (ctx.state.enteredContainerId) return ctx.state.enteredContainerId
  const ids = [...ctx.state.selectedIds]
  if (ids.length !== 1) return ctx.state.currentPageId
  const node = ctx.graph.getNode(ids[0])
  if (!node) return ctx.state.currentPageId
  if (CONTAINER_TYPES.has(node.type) && node.type !== 'CANVAS') return node.id
  return node.parentId ?? ctx.state.currentPageId
}
