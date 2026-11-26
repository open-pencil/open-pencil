import type { Page } from '@playwright/test'

import { pageScene, showView, waitForSettledScene } from '#tests/helpers/canvas/page-scene'
import type * as TextDirectionScenes from '#tests/helpers/canvas/text-direction/scene'

export async function showNumericPrefixDirection(page: Page) {
  await showView(page, { zoom: 1, panX: 0, panY: 0 })
  const textIds = await pageScene<typeof TextDirectionScenes>(
    () => page,
    '/tests/helpers/canvas/text-direction/scene.ts'
  ).build('createNumericPrefixDirectionScene')
  await page.evaluate(async (ids) => {
    await window.openPencil?.getStore?.().loadFontsForNodes(ids)
  }, textIds)
  await waitForSettledScene(page)
}
