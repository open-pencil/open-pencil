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
      const left = Math.min(...layers.map((layer) => layer.x))
      const top = Math.min(...layers.map((layer) => layer.y))
      const right = Math.max(...layers.map((layer) => layer.x + layer.width))
      const bottom = Math.max(...layers.map((layer) => layer.y + layer.height))
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
