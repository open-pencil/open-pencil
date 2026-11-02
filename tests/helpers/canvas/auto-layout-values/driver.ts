import type { Page } from '@playwright/test'

import type * as ValueScene from '#tests/helpers/canvas/auto-layout-values/scene'

/** The view the scene is shown in: canvas points are scene points times the zoom plus the pan. */
const VIEW = { zoom: 2, pan: 100 }

/** Builds the auto layout value scene, selected, and maps its points to the canvas. */
export function autoLayoutValuesDriver(page: () => Page) {
  return {
    build() {
      return page().evaluate(async (view) => {
        const store = window.lawha?.getStore?.()
        if (!store) throw new Error('Lawha store not initialized')
        const fixtureURL = '/tests/helpers/canvas/auto-layout-values/scene.ts'
        const scene: typeof ValueScene = await import(fixtureURL)
        const row = scene.createAutoLayoutValueScene(store.graph, store.state.currentPageId)
        store.runLayoutForNode(row)
        store.state.zoom = view.zoom
        store.state.panX = view.pan
        store.state.panY = view.pan
        store.select([row])
        store.requestRender()
      }, VIEW)
    },

    /** The canvas point over a scene point. */
    point(x: number, y: number) {
      return { x: VIEW.pan + x * VIEW.zoom, y: VIEW.pan + y * VIEW.zoom }
    }
  }
}
