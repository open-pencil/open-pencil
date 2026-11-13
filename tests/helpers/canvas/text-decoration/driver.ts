import type { Page } from '@playwright/test'

import { pageScene, waitForSettledScene } from '#tests/helpers/canvas/page-scene'
import type * as TextDecorationScenes from '#tests/helpers/canvas/text-decoration/scene'

/** Builds decorated text on the open page and draws it once its fonts have loaded. */
export function textDecorationDriver(page: () => Page) {
  const scenes = pageScene<typeof TextDecorationScenes>(
    page,
    '/tests/helpers/canvas/text-decoration/scene.ts'
  )
  return {
    async showColours() {
      const texts = await scenes.build('createDecorationColourScene')
      await page().evaluate(async (ids) => {
        const store = window.openPencil?.getStore?.()
        await store?.loadFontsForNodes(ids)
        store?.requestRender()
      }, texts)
      await waitForSettledScene(page())
    }
  }
}
