import { readStoredPageColor } from '@open-pencil/fig'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { CANVAS_BG_COLOR, DECK_CANVAS_BG_COLOR } from '#core/constants'

import { documentKindRules } from './document-kind'
import type { EditorContext } from './types'

interface PageViewport {
  panX: number
  panY: number
  zoom: number
  pageColor: Color
}

export function createPageViewportStore(ctx: EditorContext) {
  const pageViewports = new Map<string, PageViewport>()

  function rules() {
    return documentKindRules(ctx.state.documentKind)
  }

  /** Backdrop is fixed by the format (decks) and not user-editable. */
  function isBackdropLocked() {
    return rules().lockedBackdrop
  }

  /** Re-apply format-owned chrome after the document kind changes. */
  function applyBackdrop() {
    if (!isBackdropLocked()) return
    ctx.state.pageColor = { ...DECK_CANVAS_BG_COLOR }
    ctx.requestRender()
  }

  function saveCurrentPageViewport() {
    // Decks re-fit on every slide switch — no need to persist per-slide zoom
    if (!rules().persistPageViewports) return

    pageViewports.set(ctx.state.currentPageId, {
      panX: ctx.state.panX,
      panY: ctx.state.panY,
      zoom: ctx.state.zoom,
      pageColor: { ...ctx.state.pageColor }
    })
  }

  function restorePageViewport(pageId: string) {
    if (isBackdropLocked()) {
      // Deck slides share one size, so the camera that fitted the previous slide already
      // fits this one. Keeping it means the new slide is painted at the right size
      // immediately; resetting to zoom 1 first showed a full-size slide for a frame
      // before the re-fit landed. The re-fit that follows only refines it.
      ctx.state.pageColor = { ...DECK_CANVAS_BG_COLOR }
      return
    }

    const viewport = pageViewports.get(pageId)
    if (viewport) {
      ctx.state.panX = viewport.panX
      ctx.state.panY = viewport.panY
      ctx.state.zoom = viewport.zoom
      ctx.state.pageColor = { ...viewport.pageColor }
      return
    }

    ctx.state.panX = 0
    ctx.state.panY = 0
    ctx.state.zoom = 1
    // First visit to this page. The document may carry its own stage colour —
    // resetting to the default here is what made an imported red canvas open
    // grey, and then saved that grey back over it.
    ctx.state.pageColor = readStoredPageColor(ctx.graph, pageId) ?? { ...CANVAS_BG_COLOR }
  }

  function deletePageViewport(pageId: string) {
    pageViewports.delete(pageId)
  }

  function clearPageViewports() {
    pageViewports.clear()
  }

  return {
    saveCurrentPageViewport,
    restorePageViewport,
    deletePageViewport,
    clearPageViewports,
    applyBackdrop,
    isBackdropLocked
  }
}
