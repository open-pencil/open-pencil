import type { Page } from '@playwright/test'

/** Space around the pasted layers when they are shown, in screen pixels. */
const MARGIN = 40

/**
 * Setup: pastes Figma clipboard HTML onto the current page and shows all of it in the canvas's
 * top-left `region`, the area `screenshotCanvasRegion` captures by default.
 */
export function pasteFigmaClipboard(
  page: Page,
  html: string,
  region = { width: 900, height: 700 }
): Promise<void> {
  return page.evaluate(
    async ({ markup, margin, region }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      await store.pasteFromHTML(markup)
      store.clearSelection()
      const layers = store.graph.getChildren(store.state.currentPageId)
      let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity]
      for (const layer of layers) {
        left = Math.min(left, layer.x)
        top = Math.min(top, layer.y)
        right = Math.max(right, layer.x + layer.width)
        bottom = Math.max(bottom, layer.y + layer.height)
      }
      const width = region.width - 2 * margin
      const height = region.height - 2 * margin
      const zoom = Math.min(width / (right - left), height / (bottom - top))
      store.state.zoom = zoom
      store.state.panX = margin - left * zoom
      store.state.panY = margin - top * zoom
      store.requestRender()
    },
    { markup: html, margin: MARGIN, region }
  )
}
