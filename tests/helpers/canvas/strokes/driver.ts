import type { Page } from '@playwright/test'

import { pageScene, type SceneName } from '#tests/helpers/canvas/page-scene'
import type * as StrokeScenes from '#tests/helpers/canvas/strokes/scene'

/** A scene builder from `scene.ts`, by name. */
export type StrokeScene = SceneName<typeof StrokeScenes>

/** Builds the stroke scene `name` on the open page and leaves it unselected for a snapshot. */
export function strokeSceneDriver(page: () => Page, name: StrokeScene) {
  const scenes = pageScene<typeof StrokeScenes>(page, '/tests/helpers/canvas/strokes/scene.ts')
  return {
    show: () => scenes.build(name)
  }
}
