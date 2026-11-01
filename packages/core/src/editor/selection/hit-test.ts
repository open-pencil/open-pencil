import type { SceneNode } from '@open-pencil/scene-graph'

import { LAYER_HIT_PAD } from '#core/constants'
import type { EditorContext } from '#core/editor/types'
import { resolveEditorProfile } from '#core/editor/views'

export function createSelectionHitTestActions(
  ctx: EditorContext,
  select: (ids: string[], additive?: boolean) => void,
  clearSelection: () => void
) {
  /**
   * The layer a click selects, found from the page: the selection opens its own ancestors, so an
   * entered container never limits where a click lands, as in Figma.
   */
  function hitTestAtPoint(cx: number, cy: number, deep = false): SceneNode | null {
    const renderer = ctx.getRenderer()
    if (!renderer) return null
    const pad = LAYER_HIT_PAD / ctx.state.zoom
    const scope = ctx.state.currentPageId
    return deep
      ? ctx.graph.hitTestDeep(cx, cy, scope, pad)
      : ctx.graph.hitTestSelectable(
          cx,
          cy,
          scope,
          ctx.state.selectedIds,
          pad,
          resolveEditorProfile(ctx.state).framesOpen
        )
  }

  /**
   * Selects what a right-click is over, as Figma does: the layer a click would select, or else the
   * frame or section whose empty area is under the point, which a click leaves for a marquee.
   */
  function selectAtPoint(cx: number, cy: number) {
    const hit =
      hitTestAtPoint(cx, cy) ?? ctx.graph.hitTestOpenContainer(cx, cy, ctx.state.currentPageId)
    if (hit) {
      if (!ctx.state.selectedIds.has(hit.id)) select([hit.id])
    } else {
      clearSelection()
    }
  }

  return { hitTestAtPoint, selectAtPoint }
}
