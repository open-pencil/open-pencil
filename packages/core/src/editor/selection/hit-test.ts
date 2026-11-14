import type { SceneNode } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { LAYER_HIT_PAD } from '#core/constants'
import type { EditorContext } from '#core/editor/types'
import { resolveEditorProfile } from '#core/editor/views'

export function createSelectionHitTestActions(
  ctx: EditorContext,
  select: (ids: string[], additive?: boolean) => void,
  clearSelection: () => void,
  enterContainerOf: (nodeId: string) => void
) {
  /**
   * The layer a click selects, found from the page: the selection and the entered container open
   * their ancestors, so an entered container never limits where a click lands, as in Figma.
   */
  function hitTestAtPoint(cx: number, cy: number, deep = false): SceneNode | null {
    return hitAt(cx, cy, deep, false)
  }

  /** As `hitTestAtPoint`, with locked layers hit (`locked`), as a right-click hits them. */
  function hitAt(cx: number, cy: number, deep: boolean, locked: boolean): SceneNode | null {
    const renderer = ctx.getRenderer()
    if (!renderer) return null
    const pad = LAYER_HIT_PAD / ctx.state.zoom
    const scope = ctx.state.currentPageId
    if (ctx.state.enteredContainerId && !ctx.graph.getNode(ctx.state.enteredContainerId)) {
      ctx.state.enteredContainerId = null
    }
    return deep
      ? ctx.graph.hitTestDeep(cx, cy, scope, pad)
      : ctx.graph.hitTestSelectable(cx, cy, scope, ctx.state.selectedIds, {
          pad,
          framesOpen: resolveEditorProfile(ctx.state).framesOpen,
          enteredId: ctx.state.enteredContainerId,
          locked
        })
  }

  /**
   * A name drawn on a pane's overlay canvas, in draw order: a component's label, then a section
   * title, then a frame title. A right-click hits a locked layer's name as it hits its body.
   */
  function labelAt(renderer: SkiaRenderer, cx: number, cy: number): SceneNode | null {
    const preview = ctx.state.rotationPreview
    const graph = ctx.graph
    const filter = { locked: true }
    if (typeof renderer.hitTestComponentLabel === 'function') {
      const component = renderer.hitTestComponentLabel(graph, cx, cy, preview, filter)
      if (component) return component
    }
    if (typeof renderer.hitTestSectionTitle === 'function') {
      const section = renderer.hitTestSectionTitle(graph, cx, cy, preview, filter)
      if (section) return section
    }
    return typeof renderer.hitTestFrameTitle === 'function'
      ? renderer.hitTestFrameTitle(graph, cx, cy, preview, filter)
      : null
  }

  /**
   * Selects what a right-click is over, as Figma does: the layer a click would select, a locked
   * one included, or else the frame or section whose empty area is under the point, which a click
   * leaves for a marquee. A name above a frame, section, or component is part of that layer, read
   * from `renderer` (the pane's overlay canvas; the editor's current canvas when omitted). The
   * entered container follows the selection, as it does after a press.
   */
  function selectAtPoint(cx: number, cy: number, renderer?: SkiaRenderer | null) {
    // Each pane hit-tests names with its own page, zoom, viewport, and label cache.
    const labels = renderer === undefined ? ctx.getRenderer() : renderer
    const hit =
      (labels ? labelAt(labels, cx, cy) : null) ??
      hitAt(cx, cy, false, true) ??
      ctx.graph.hitTestOpenContainer(cx, cy, ctx.state.currentPageId)
    if (hit) {
      if (!ctx.state.selectedIds.has(hit.id)) {
        select([hit.id])
        enterContainerOf(hit.id)
      }
    } else {
      clearSelection()
    }
  }

  return { hitTestAtPoint, selectAtPoint }
}
