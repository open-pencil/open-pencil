import type { Page } from '@playwright/test'

import { pageScene, showView } from '#tests/helpers/canvas/page-scene'
import { readScenePixels } from '#tests/helpers/canvas/pixels'
import {
  SAVED_GLYPH_LAYER_BOX,
  SAVED_GLYPH_LAYER_FONT_SIZE,
  SAVED_GLYPH_LAYER_SHEET
} from '#tests/helpers/canvas/saved-glyph-layer/scene'
import type * as SavedGlyphLayerScenes from '#tests/helpers/canvas/saved-glyph-layer/scene'

function samePixel(a: readonly number[], b: readonly number[]): boolean {
  return a.every((channel, index) => channel === b[index])
}

export function savedGlyphLayerDriver(page: () => Page) {
  const scenes = pageScene<typeof SavedGlyphLayerScenes>(
    page,
    '/tests/helpers/canvas/saved-glyph-layer/scene.ts'
  )

  return {
    async show() {
      const texts = await scenes.build('createSavedGlyphLayerScene')
      await page().evaluate(async (ids) => {
        await window.openPencil?.getStore?.().loadFontsForNodes(ids)
      }, texts)
      await showView(page(), { zoom: 1, panX: 0, panY: 0 })
    },

    /** Whether a copy draws the same pixel above, inside, and below its box, and draws one at all. */
    async keepsInkPastBox(x: number): Promise<boolean> {
      const { y, height } = SAVED_GLYPH_LAYER_BOX
      const [above, inside, below] = await readScenePixels(
        page(),
        [y - 3, y + height / 2, y + height + 3].map((row) => ({
          x: x + SAVED_GLYPH_LAYER_FONT_SIZE / 2,
          y: row
        }))
      )
      const inked = inside.some((channel) => channel !== 255)
      return inked && samePixel(above, inside) && samePixel(below, inside)
    },

    /** The sheet's region of the page, for a screenshot of the scene. */
    async sheetClip() {
      const box = await page().getByTestId('canvas-element').boundingBox()
      if (!box) throw new Error('Canvas has no box')
      return { x: box.x, y: box.y, ...SAVED_GLYPH_LAYER_SHEET }
    }
  }
}
