import type { SceneNode } from '@open-pencil/scene-graph'

import { documentKindRules } from '#core/editor/document-kind'
import type { EditorContext } from '#core/editor/types'

export function createSelectionHitTestActions(
  ctx: EditorContext,
  select: (ids: string[], additive?: boolean) => void,
  clearSelection: () => void
) {
  /**
   * A deck slide is fixed chrome holding the content, not an object the user owns, so it
   * never takes a selection itself. A click that lands on the slide resolves to whatever
   * sits on it, and a click on bare slide background resolves to nothing.
   */
  function resolveThroughFixedArtboard(
    hit: SceneNode | null,
    cx: number,
    cy: number,
    deep: boolean
  ): SceneNode | null {
    if (!hit || documentKindRules(ctx.state.documentKind).artboardSelectable) return hit
    const isTopLevelArtboard = hit.type === 'FRAME' && hit.parentId === ctx.state.currentPageId
    if (!isTopLevelArtboard) return hit
    return deep ? ctx.graph.hitTestDeep(cx, cy, hit.id) : ctx.graph.hitTest(cx, cy, hit.id)
  }

  function hitTestAtPoint(cx: number, cy: number, deep = false): SceneNode | null {
    const renderer = ctx.getRenderer()
    if (!renderer) return null
    const scopeId = ctx.state.enteredContainerId
    if (scopeId) {
      const scopeNode = ctx.graph.getNode(scopeId)
      if (!scopeNode) {
        ctx.state.enteredContainerId = null
      } else {
        return deep ? ctx.graph.hitTestDeep(cx, cy, scopeId) : ctx.graph.hitTest(cx, cy, scopeId)
      }
    }
    const hit = deep
      ? ctx.graph.hitTestDeep(cx, cy, ctx.state.currentPageId)
      : ctx.graph.hitTest(cx, cy, ctx.state.currentPageId)
    return resolveThroughFixedArtboard(hit, cx, cy, deep)
  }

  function selectAtPoint(cx: number, cy: number) {
    const hit = hitTestAtPoint(cx, cy)
    if (hit) {
      if (!ctx.state.selectedIds.has(hit.id)) select([hit.id])
    } else {
      clearSelection()
    }
  }

  return { hitTestAtPoint, selectAtPoint }
}
