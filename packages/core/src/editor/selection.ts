import { generatedFrameOwner } from '@open-pencil/scene-graph/generated'

import { createSelectionContainerActions } from './selection/container'
import { createSelectionHitTestActions } from './selection/hit-test'
import { createSelectionNavigationActions } from './selection/navigation'
import { createSelectionOverlayActions } from './selection/overlays'
import { createSelectionReadActions } from './selection/read'
import type { EditorContext } from './types'

export function createSelectionActions(ctx: EditorContext) {
  function nested(a: string, b: string) {
    return ctx.graph.isDescendant(a, b) || ctx.graph.isDescendant(b, a)
  }

  /** The outermost of the layers: one inside another listed layer is dropped. */
  function outermost(ids: string[]): Set<string> {
    const listed = new Set(ids)
    return new Set(
      ids.filter((id) => {
        const parentId = ctx.graph.getNode(id)?.parentId
        return !parentId || !ctx.graph.closest(parentId, (node) => listed.has(node.id))
      })
    )
  }

  /** A generated frame's sublayer is selected as the frame, such as a sticky note's body. */
  function selectable(id: string): string {
    const node = ctx.graph.getNode(id)
    return (node && generatedFrameOwner(ctx.graph, node)?.id) ?? id
  }

  /**
   * Figma never selects a layer together with one of its ancestors. A plain selection keeps the
   * outermost layers; adding a layer replaces its selected ancestors and descendants.
   */
  function select(requested: string[], additive = false) {
    const ids = requested.map(selectable)
    if (!additive) {
      ctx.setSelectedIds(outermost(ids))
      return
    }
    let next = new Set(ctx.state.selectedIds)
    for (const id of ids) {
      if (next.has(id)) {
        next.delete(id)
        continue
      }
      next = new Set([...next].filter((other) => !nested(other, id)))
      next.add(id)
    }
    ctx.setSelectedIds(next)
  }

  function clearSelection() {
    ctx.setSelectedIds(new Set())
  }

  function selectAll() {
    const children = ctx.graph.getChildren(ctx.state.currentPageId)
    ctx.setSelectedIds(new Set(children.map((n) => n.id)))
  }

  function selectInverse() {
    const children = ctx.graph.getChildren(ctx.state.currentPageId)
    ctx.setSelectedIds(
      new Set(children.filter((node) => !ctx.state.selectedIds.has(node.id)).map((node) => node.id))
    )
  }

  const containerActions = createSelectionContainerActions(ctx)
  const hitTestActions = createSelectionHitTestActions(ctx, select, clearSelection)
  const navigationActions = createSelectionNavigationActions(ctx, select)
  const overlayActions = createSelectionOverlayActions(ctx)
  const readActions = createSelectionReadActions(ctx)

  return {
    select,
    clearSelection,
    selectAll,
    selectInverse,
    ...navigationActions,
    ...overlayActions,
    ...containerActions,
    ...readActions,
    ...hitTestActions
  }
}
