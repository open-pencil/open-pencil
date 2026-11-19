import type { Page } from '@playwright/test'

import type * as ValueScene from '#tests/helpers/canvas/auto-layout-values/scene'
import { pageScene, showView, waitForSettledScene } from '#tests/helpers/canvas/page-scene'

/** The view the scene is shown in: canvas points are scene points times the zoom plus the pan. */
const VIEW = { zoom: 2, pan: 100 }

/** Builds the auto layout value scene, selected, and maps its points to the canvas. */
export function autoLayoutValuesDriver(page: () => Page) {
  const scenes = pageScene<typeof ValueScene>(
    page,
    '/tests/helpers/canvas/auto-layout-values/scene.ts'
  )
  return {
    async build(variant: ValueScene.ValueSceneVariant = {}) {
      await showView(page(), { zoom: VIEW.zoom, panX: VIEW.pan, panY: VIEW.pan })
      const row = await scenes.build('createAutoLayoutValueScene', variant)
      await page().evaluate((id) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.runLayoutForNode(id)
        store.select([id])
      }, row)
      await waitForSettledScene(page())
    },

    /**
     * The canvas point over a point of the row, `rotation` degrees turned about the middle of a
     * `width` × `height` row, as the editor turns a layer.
     */
    point(x: number, y: number, turn?: { rotation: number; width: number; height: number }) {
      if (!turn) return { x: VIEW.pan + x * VIEW.zoom, y: VIEW.pan + y * VIEW.zoom }
      const angle = (turn.rotation * Math.PI) / 180
      const [cx, cy] = [turn.width / 2, turn.height / 2]
      const [dx, dy] = [x - cx, y - cy]
      const sceneX = cx + dx * Math.cos(angle) - dy * Math.sin(angle)
      const sceneY = cy + dx * Math.sin(angle) + dy * Math.cos(angle)
      return { x: VIEW.pan + sceneX * VIEW.zoom, y: VIEW.pan + sceneY * VIEW.zoom }
    }
  }
}
