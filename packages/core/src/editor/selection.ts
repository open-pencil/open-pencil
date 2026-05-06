import { createSelectionContainerActions } from './selection/container'
import { createSelectionHitTestActions } from './selection/hit-test'
import { createSelectionOverlayActions } from './selection/overlays'
import { createSelectionReadActions } from './selection/read'
import type { EditorContext } from './types'

export function createSelectionActions(ctx: EditorContext) {
  function select(ids: string[], additive = false) {
    if (additive) {
      const next = new Set(ctx.state.selectedIds)
      for (const id of ids) {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      }
      ctx.setSelectedIds(next)
    } else {
      ctx.setSelectedIds(new Set(ids))
    }
  }

  function clearSelection() {
    ctx.setSelectedIds(new Set())
  }

  function selectAll() {
    const children = ctx.graph.getChildren(ctx.state.currentPageId)
    ctx.setSelectedIds(new Set(children.map((n) => n.id)))
  }

  const containerActions = createSelectionContainerActions(ctx)
  const hitTestActions = createSelectionHitTestActions(ctx, select, clearSelection)
  const overlayActions = createSelectionOverlayActions(ctx)
  const readActions = createSelectionReadActions(ctx)

  return {
    select,
    clearSelection,
    selectAll,
    ...overlayActions,
    ...containerActions,
    ...readActions,
    ...hitTestActions
  }
}
