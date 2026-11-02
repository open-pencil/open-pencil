import type { Page } from '@playwright/test'

import type * as EffectScenes from '#tests/helpers/canvas/effects/scene'

/** Builds the blur effects scene on the open page and leaves it unselected for a snapshot. */
export function blurEffectsDriver(page: () => Page) {
  return {
    show() {
      return page().evaluate(async () => {
        const store = window.lawha?.getStore?.()
        if (!store) throw new Error('Lawha store not initialized')
        const sceneURL = '/tests/helpers/canvas/effects/scene.ts'
        const scenes: typeof EffectScenes = await import(sceneURL)
        scenes.createBlurEffectsScene(store.graph, store.state.currentPageId)
        store.clearSelection()
        store.requestRender()
      })
    }
  }
}

/** Builds the shadow silhouette scene on the open page and leaves it unselected for a snapshot. */
export function shadowSilhouetteDriver(page: () => Page) {
  return {
    show() {
      return page().evaluate(async () => {
        const store = window.lawha?.getStore?.()
        if (!store) throw new Error('Lawha store not initialized')
        const sceneURL = '/tests/helpers/canvas/effects/scene.ts'
        const scenes: typeof EffectScenes = await import(sceneURL)
        scenes.createShadowSilhouetteScene(store.graph, store.state.currentPageId)
        store.clearSelection()
        store.requestRender()
      })
    }
  }
}
