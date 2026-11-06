import type { Page } from '@playwright/test'

import type { ConstraintType } from '@open-pencil/scene-graph'

import type * as ConstraintScene from '#tests/helpers/canvas/constraint-indicators/scene'
import { pageScene, showView } from '#tests/helpers/canvas/page-scene'

/** Builds a frame holding one constrained rectangle at 100% zoom and selects the rectangle. */
export function constraintIndicatorDriver(page: () => Page) {
  return {
    async selectConstrainedLayer(
      horizontal: ConstraintType,
      vertical: ConstraintType,
      rotation = 0
    ) {
      const ids = await pageScene<typeof ConstraintScene>(
        page,
        '/tests/helpers/canvas/constraint-indicators/scene.ts'
      ).build('createConstrainedLayerScene', horizontal, vertical, rotation)
      await showView(page(), { zoom: 1, panX: 0, panY: 0 })
      await page().evaluate((id) => window.openPencil?.getStore?.().select([id]), ids.rectangle)
    }
  }
}
