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
   * A name drawn on one canvas, in draw order: a component's label, then a section title, then a
   * frame title. The scene canvas does not paint names; the overlay canvas of a pane does.
   */
  function labelOnRenderer(renderer: SkiaRenderer, cx: number, cy: number): SceneNode | null {
    const preview = ctx.state.rotationPreview
    const graph = ctx.graph
    if (typeof renderer.hitTestComponentLabel === 'function') {
      const component = renderer.hitTestComponentLabel(graph, cx, cy, preview)
      if (component) return component
    }
    if (typeof renderer.hitTestSectionTitle === 'function') {
      const section = renderer.hitTestSectionTitle(graph, cx, cy, preview)
      if (section) return section
    }
    return typeof renderer.hitTestFrameTitle === 'function'
      ? renderer.hitTestFrameTitle(graph, cx, cy, preview)
      : null
  }

  /**
   * A name above a frame, section, or component on the canvas that was clicked. Each pane hit-tests
   * with its own page, zoom, viewport, and label cache, so another pane's canvas is not asked.
   */
  function labelAt(renderer: SkiaRenderer | null, cx: number, cy: number): SceneNode | null {
    return renderer ? labelOnRenderer(renderer, cx, cy) : null
  }

  /**
   * Selects what a right-click is over, as Figma does: the layer a click would select, a locked
   * one included, or else the frame or section whose empty area is under the point, which a click
   * leaves for a marquee. A name above a frame, section, or component is part of that layer, read
   * from `renderer` (the pane's overlay canvas; the editor's current canvas when omitted). The
   * entered container follows the selection, as it does after a press.
   */
  function selectAtPoint(cx: number, cy: number, renderer?: SkiaRenderer | null) {
    const hit =
      labelAt(renderer === undefined ? ctx.getRenderer() : renderer, cx, cy) ??
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
