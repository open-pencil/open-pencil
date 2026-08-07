import { readStoredPageColor } from '@open-pencil/fig'

import { CANVAS_BG_COLOR, DECK_CANVAS_BG_COLOR } from '#core/constants'

import { documentKindRules } from './document-kind'
import type { EditorContext, Viewport } from './types'

/**
 * Camera only. The stage colour is NOT cached here.
 *
 * It used to be, and that shadowed the document: `replaceGraph` sets
 * `currentPageId` before `switchPage` runs, so the save-then-restore inside
 * `switchPage` wrote the *previous* document's colour into the cache under the
 * *new* page's id and immediately restored it — and the stored value was never
 * read. `setPageColor` writes through to the document, so the document is the
 * only source of truth and this cache has nothing to add.
 */
export function createPageViewportStore(ctx: EditorContext) {
  const pageViewports = new Map<string, Viewport>()

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
      zoom: ctx.state.zoom
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

    // Always from the document, never from the camera cache — a page carries
    // its stage colour, and re-entering it must not resurrect whatever colour
    // happened to be in editor state when the page was last left.
    ctx.state.pageColor = readStoredPageColor(ctx.graph, pageId) ?? { ...CANVAS_BG_COLOR }

    const viewport = pageViewports.get(pageId)
    if (viewport) {
      ctx.state.panX = viewport.panX
      ctx.state.panY = viewport.panY
      ctx.state.zoom = viewport.zoom
      return
    }

    ctx.state.panX = 0
    ctx.state.panY = 0
    ctx.state.zoom = 1
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
