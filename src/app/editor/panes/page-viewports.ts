import { getDefaultCanvasBgColor } from '@open-pencil/core/constants'
import type { PageViewport } from '@open-pencil/core/editor'
import type { Color } from '@open-pencil/core/types'

import type { AppCanvasPaneState } from './types'

export function savePanePageViewport(pane: AppCanvasPaneState): void {
  pane.pageViewports.set(pane.currentPageId, {
    panX: pane.panX,
    panY: pane.panY,
    zoom: pane.zoom,
    pageColor: { ...pane.pageColor }
  })
}

export function restorePanePageViewport(
  pane: AppCanvasPaneState,
  pageId: string,
  fallbackColor?: Color
): void {
  const viewport = pane.pageViewports.get(pageId)
  if (viewport) {
    applyPaneViewport(pane, viewport)
    return
  }

  pane.panX = 0
  pane.panY = 0
  pane.zoom = 1
  pane.pageColor = { ...(fallbackColor ?? getDefaultCanvasBgColor()) }
}

export function deletePanePageViewport(pane: AppCanvasPaneState, pageId: string): void {
  pane.pageViewports.delete(pageId)
}

export function clearPanePageViewports(pane: AppCanvasPaneState): void {
  pane.pageViewports.clear()
}

function applyPaneViewport(pane: AppCanvasPaneState, viewport: PageViewport): void {
  pane.panX = viewport.panX
  pane.panY = viewport.panY
  pane.zoom = viewport.zoom
  pane.pageColor = { ...viewport.pageColor }
}
