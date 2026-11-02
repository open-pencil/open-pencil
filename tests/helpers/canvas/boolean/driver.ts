import type { Page } from '@playwright/test'

import type * as BooleanScenes from '#tests/helpers/canvas/boolean/scene'

export function booleanStrokeAlignmentDriver(page: () => Page) {
  return {
    show() {
      return page().evaluate(async () => {
        const store = window.openPencil?.getStore?.()
        if (!store) {
          throw new Error('OpenPencil store not initialized')
        }
        const sceneURL = '/tests/helpers/canvas/boolean/scene.ts'
        const scenes: typeof BooleanScenes = await import(sceneURL)
        scenes.createBooleanStrokeAlignmentScene(store.graph, store.state.currentPageId)
        store.clearSelection()
        store.requestRender()
      })
    }
  }
}
