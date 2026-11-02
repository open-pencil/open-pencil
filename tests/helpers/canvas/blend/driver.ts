import type { Page } from '@playwright/test'

import type * as BlendScenes from '#tests/helpers/canvas/blend/scene'

export function linearBlendDriver(page: () => Page) {
  return {
    show() {
      return page().evaluate(async () => {
        const store = window.lawha?.getStore?.()
        if (!store) {
          throw new Error('Lawha store not initialized')
        }
        const sceneURL = '/tests/helpers/canvas/blend/scene.ts'
        const scenes: typeof BlendScenes = await import(sceneURL)
        scenes.createLinearBlendScene(store.graph, store.state.currentPageId)
        store.clearSelection()
        store.requestRender()
      })
    }
  }
}
