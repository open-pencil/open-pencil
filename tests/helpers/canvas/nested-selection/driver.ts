import type { Page } from '@playwright/test'

import type * as NestedScene from '#tests/helpers/canvas/nested-selection/scene'
import { pageScene, showView } from '#tests/helpers/canvas/page-scene'

/** Builds the nested-selection scene at 100% zoom and selects a layer two frames deep. */
export function nestedSelectionDriver(page: () => Page) {
  return {
    async selectNestedRectangle() {
      const ids = await pageScene<typeof NestedScene>(
        page,
        '/tests/helpers/canvas/nested-selection/scene.ts'
      ).build('createNestedSelectionScene')
      await showView(page(), { zoom: 1, panX: 0, panY: 0 })
      await page().evaluate((id) => window.openPencil?.getStore?.().select([id]), ids.rectangle)
    }
  }
}
