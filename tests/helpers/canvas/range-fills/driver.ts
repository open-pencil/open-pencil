import type { Page } from '@playwright/test'

import { loadSceneFonts, pageScene } from '#tests/helpers/canvas/page-scene'
import type * as RangeFillScenes from '#tests/helpers/canvas/range-fills/scene'

/** Builds texts whose ranges have fills of their own and draws them once their fonts have loaded. */
export function rangeFillsDriver(page: () => Page) {
  const scenes = pageScene<typeof RangeFillScenes>(
    page,
    '/tests/helpers/canvas/range-fills/scene.ts'
  )
  return {
    async show() {
      await loadSceneFonts(page(), await scenes.build('createRangeFillScene'))
    }
  }
}
