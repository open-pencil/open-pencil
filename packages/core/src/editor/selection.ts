import { documentKindRules } from './document-kind'
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
    if (documentKindRules(ctx.state.documentKind).artboardSelectable) {
      ctx.setSelectedIds(new Set(children.map((n) => n.id)))
      return
    }
    // A deck slide cannot be selected, so "everything" means everything on the slide.
    const ids = children.flatMap((node) =>
      node.type === 'FRAME' ? ctx.graph.getChildren(node.id).map((child) => child.id) : [node.id]
    )
    ctx.setSelectedIds(new Set(ids))
  }

  function selectInverse() {
    const children = ctx.graph.getChildren(ctx.state.currentPageId)
    ctx.setSelectedIds(
      new Set(children.filter((node) => !ctx.state.selectedIds.has(node.id)).map((node) => node.id))
    )
  }

  const containerActions = createSelectionContainerActions(ctx)
  const hitTestActions = createSelectionHitTestActions(ctx, select, clearSelection)
  const overlayActions = createSelectionOverlayActions(ctx)
  const readActions = createSelectionReadActions(ctx)

  return {
    select,
    clearSelection,
    selectAll,
    selectInverse,
    ...overlayActions,
    ...containerActions,
    ...readActions,
    ...hitTestActions
  }
}
