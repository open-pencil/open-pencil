import type { Page } from '@playwright/test'

import type * as VectorEditScene from '#tests/helpers/canvas/vector-edit/scene'

/** Builds the component vector scene, selects its layers, and reads which path is open. */
export function vectorEditDriver(page: () => Page) {
  return {
    build() {
      return page().evaluate(async () => {
        const store = window.lawha?.getStore?.()
        if (!store) throw new Error('Lawha store not initialized')
        const fixtureURL = '/tests/helpers/canvas/vector-edit/scene.ts'
        const scene: typeof VectorEditScene = await import(fixtureURL)
        const ids = scene.createComponentVectorScene(store.graph, store.state.currentPageId)
        store.requestRender()
        return ids
      })
    },

    select(id: string) {
      return page().evaluate((nodeId) => window.lawha?.getStore?.().select([nodeId]), id)
    },

    /** The layer whose path is open for editing, if any. */
    editedNode() {
      return page().evaluate(
        () => window.lawha?.getStore?.().state.nodeEditState?.nodeId ?? null
      )
    },

    closeEdit() {
      return page().evaluate(() => window.lawha?.getStore?.().exitNodeEditMode(true))
    }
  }
}
