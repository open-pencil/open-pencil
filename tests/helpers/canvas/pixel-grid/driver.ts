import type { Page } from '@playwright/test'

import { pageScene, showView } from '#tests/helpers/canvas/page-scene'
import type * as PixelGridScene from '#tests/helpers/canvas/pixel-grid/scene'

/** Builds the pixel grid scene at a zoom and reads back the snapping preference. */
export function pixelGridDriver(page: () => Page) {
  const scenes = pageScene<typeof PixelGridScene>(page, '/tests/helpers/canvas/pixel-grid/scene.ts')
  return {
    /** The probe rectangle 40 screen pixels in from the canvas corner at `zoom`. */
    async showAtZoom(zoom: number) {
      await scenes.build('createPixelGridScene')
      await showView(page(), { zoom, panX: 40, panY: 40 })
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
