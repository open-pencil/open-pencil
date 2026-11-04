import type { Page } from '@playwright/test'

import type * as ValueScene from '#tests/helpers/canvas/auto-layout-values/scene'
import { pageScene, showView } from '#tests/helpers/canvas/page-scene'

/** The view the scene is shown in: canvas points are scene points times the zoom plus the pan. */
const VIEW = { zoom: 2, pan: 100 }

/** Builds the auto layout value scene, selected, and maps its points to the canvas. */
export function autoLayoutValuesDriver(page: () => Page) {
  const scenes = pageScene<typeof ValueScene>(
    page,
    '/tests/helpers/canvas/auto-layout-values/scene.ts'
  )
  return {
    async build() {
      const row = await scenes.build('createAutoLayoutValueScene')
      await page().evaluate((id) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.runLayoutForNode(id)
        store.select([id])
      }, row)
      await showView(page(), { zoom: VIEW.zoom, panX: VIEW.pan, panY: VIEW.pan })
    },

    /** The canvas point over a scene point. */
    point(x: number, y: number) {
      return { x: VIEW.pan + x * VIEW.zoom, y: VIEW.pan + y * VIEW.zoom }
    }
  }
}
