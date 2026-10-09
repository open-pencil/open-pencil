import type { Page } from '@playwright/test'

import type * as PixelGridScene from '#tests/helpers/canvas/pixel-grid'

/** Builds the pixel grid scene at a zoom and reads back the snapping preference. */
export function pixelGridDriver(page: () => Page) {
  return {
    /** The probe rectangle 40 screen pixels in from the canvas corner at `zoom`. */
    showAtZoom(zoom: number) {
      return page().evaluate(async (zoom) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const fixtureURL = '/tests/helpers/canvas/pixel-grid.ts'
        const scene: typeof PixelGridScene = await import(fixtureURL)
        scene.createPixelGridScene(store.graph, store.state.currentPageId)
        store.state.zoom = zoom
        store.state.panX = 40
        store.state.panY = 40
        store.clearSelection()
        store.requestRender()
      }, zoom)
    },

    devicePixelRatio() {
      return page().evaluate(() => devicePixelRatio)
    },

    snapsToPixelGrid() {
      return page().evaluate(
        () => window.openPencil?.getStore?.().state.snappingPreferences.pixelGrid
      )
    }
  }
}
