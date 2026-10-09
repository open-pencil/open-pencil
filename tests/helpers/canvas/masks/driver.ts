import type { Page } from '@playwright/test'

import type * as MaskScenes from '#tests/helpers/canvas/masks/scene'

/** Builds a mask scene on the open page and leaves it unselected for a canvas snapshot. */
export function maskSceneDriver(page: () => Page) {
  return {
    show(name: MaskScenes.MaskSceneName) {
      return page().evaluate(async (name) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const sceneURL = '/tests/helpers/canvas/masks/scene.ts'
        const scenes: typeof MaskScenes = await import(sceneURL)
        await scenes.MASK_SCENES[name](store.graph, store.state.currentPageId, (bytes) =>
          store.storeImage(bytes)
        )
        store.clearSelection()
        store.requestRender()
      }, name)
    }
  }
}
