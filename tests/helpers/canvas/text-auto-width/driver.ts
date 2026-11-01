import type { Page } from '@playwright/test'

import type * as TextAutoWidthScenes from '#tests/helpers/canvas/text-auto-width/scene'

export function textAutoWidthDriver(page: () => Page) {
  return {
    show() {
      return page().evaluate(async () => {
        const store = window.openPencil?.getStore?.()
        if (!store) {
          throw new Error('OpenPencil store not initialized')
        }
        const sceneURL = '/tests/helpers/canvas/text-auto-width/scene.ts'
        const scenes: typeof TextAutoWidthScenes = await import(sceneURL)
        scenes.createTextAutoWidthScene(store.graph, store.state.currentPageId)
        store.clearSelection()
        store.requestRender()
      })
    }
  }
}
