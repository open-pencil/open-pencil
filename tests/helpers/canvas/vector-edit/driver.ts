import type { Page } from '@playwright/test'

import { pageScene } from '#tests/helpers/canvas/page-scene'
import type * as VectorEditScene from '#tests/helpers/canvas/vector-edit/scene'

/** Builds the component vector scene, selects its layers, and reads which path is open. */
export function vectorEditDriver(page: () => Page) {
  const scenes = pageScene<typeof VectorEditScene>(
    page,
    '/tests/helpers/canvas/vector-edit/scene.ts'
  )
  return {
    build: () => scenes.build('createComponentVectorScene'),

    select(id: string) {
      return page().evaluate((nodeId) => window.openPencil?.getStore?.().select([nodeId]), id)
    },

    /** The layer whose path is open for editing, if any. */
    editedNode() {
      return page().evaluate(
        () => window.openPencil?.getStore?.().state.nodeEditState?.nodeId ?? null
      )
    },

    closeEdit() {
      return page().evaluate(() => window.openPencil?.getStore?.().exitNodeEditMode(true))
    }
  }
}
