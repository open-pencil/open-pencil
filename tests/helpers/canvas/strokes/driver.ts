import type { Page } from '@playwright/test'

import type * as StrokeScenes from '#tests/helpers/canvas/strokes/scene'

/** A scene builder from `scene.ts`, by name. */
export type StrokeScene = {
  [Name in keyof typeof StrokeScenes]: (typeof StrokeScenes)[Name] extends (
    ...args: never[]
  ) => void
    ? Name
    : never
}[keyof typeof StrokeScenes]

/** Builds the stroke scene `name` on the open page and leaves it unselected for a snapshot. */
export function strokeSceneDriver(page: () => Page, name: StrokeScene) {
  return {
    show() {
      return page().evaluate(async (sceneName) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const sceneURL = '/tests/helpers/canvas/strokes/scene.ts'
        const scenes: typeof StrokeScenes = await import(sceneURL)
        scenes[sceneName](store.graph, store.state.currentPageId)
        store.clearSelection()
        store.requestRender()
      }, name)
    }
  }
}
