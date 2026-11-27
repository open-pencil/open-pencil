import type { Page } from '@playwright/test'

import { loadSceneFonts, pageScene } from '#tests/helpers/canvas/page-scene'
import type * as TextDecorationScenes from '#tests/helpers/canvas/text-decoration/scene'

/** Builds decorated text on the open page and draws it once its fonts have loaded. */
export function textDecorationDriver(page: () => Page) {
  const scenes = pageScene<typeof TextDecorationScenes>(
    page,
    '/tests/helpers/canvas/text-decoration/scene.ts'
  )
  return {
    async showColours() {
      await loadSceneFonts(page(), await scenes.build('createDecorationColourScene'))
    }
  }
}
