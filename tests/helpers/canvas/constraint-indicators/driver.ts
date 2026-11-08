import type { Page } from '@playwright/test'

import type { ConstraintType } from '@open-pencil/scene-graph'

import type * as ConstraintScene from '#tests/helpers/canvas/constraint-indicators/scene'
import { pageScene, showView } from '#tests/helpers/canvas/page-scene'

/** Builds constrained scenes at 100% zoom and selects a layer in them. */
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
    },

    /** Builds a frame holding a group and selects the group or the first layer in it. */
    async selectInGroup(second: ConstraintType, select: 'group' | 'first') {
      const ids = await pageScene<typeof ConstraintScene>(
        page,
        '/tests/helpers/canvas/constraint-indicators/scene.ts'
      ).build('createConstrainedGroupScene', second)
      await showView(page(), { zoom: 1, panX: 0, panY: 0 })
      await page().evaluate((id) => window.openPencil?.getStore?.().select([id]), ids[select])
    }
  }
}
