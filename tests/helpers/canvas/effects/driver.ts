import type { Page } from '@playwright/test'

import type * as EffectScenes from '#tests/helpers/canvas/effects/scene'

/** Builds the blur effects scene on the open page and leaves it unselected for a snapshot. */
export function blurEffectsDriver(page: () => Page) {
  return {
    show() {
      return page().evaluate(async () => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const sceneURL = '/tests/helpers/canvas/effects/scene.ts'
        const scenes: typeof EffectScenes = await import(sceneURL)
        scenes.createBlurEffectsScene(store.graph, store.state.currentPageId)
        store.clearSelection()
        store.requestRender()
      })
    }
  }
}
