import type { Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import type * as LayerBoundsScenes from '#tests/helpers/canvas/layer-bounds/scene'
import type { LayerBoundsProbes } from '#tests/helpers/canvas/layer-bounds/scene'
import { pageScene, showView } from '#tests/helpers/canvas/page-scene'
import { readScenePixels } from '#tests/helpers/canvas/pixels'

/** How far a probe's colour is from the blank canvas, summed over red, green, and blue. */
function distance(pixel: number[], blank: number[]): number {
  return [0, 1, 2].reduce((sum, channel) => sum + Math.abs(pixel[channel] - blank[channel]), 0)
}

export function layerBoundsDriver(page: () => Page) {
  const canvas = () => new CanvasHelper(page())
  const scenes = pageScene<typeof LayerBoundsScenes>(
    page,
    '/tests/helpers/canvas/layer-bounds/scene.ts'
  )
  let probes: LayerBoundsProbes | null = null

  return {
    async show() {
      probes = await scenes.build('createLayerBoundsScene')
      await showView(page(), { zoom: 1, panX: 0, panY: 0 })
      await canvas().waitForRender()
    },

    /** How far each probe's colour is from the blank canvas, by the probe's name. */
    async inkAtProbes(): Promise<Record<string, number>> {
      if (!probes) throw new Error('Show the scene first')
      const { blank, ...drawn } = probes
      const names = Object.keys(drawn)
      const [blankPixel, ...pixels] = await readScenePixels(page(), [
        blank,
        ...names.map((name) => drawn[name as keyof typeof drawn])
      ])
      return Object.fromEntries(
        names.map((name, index) => [name, distance(pixels[index], blankPixel)])
      )
    },

    capture: () => canvas().screenshotCanvasRegion(780, 420)
  }
}
