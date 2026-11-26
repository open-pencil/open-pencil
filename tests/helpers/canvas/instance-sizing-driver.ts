import type { Page } from '@playwright/test'

import type * as InstanceSizingScene from '#tests/helpers/canvas/instance-sizing'
import { pageScene, showView } from '#tests/helpers/canvas/page-scene'

/** Builds and selects layers in the instance resize fixture. */
export async function buildInstanceResizeScene(page: Page) {
  const nodes = await pageScene<typeof InstanceSizingScene>(
    () => page,
    '/tests/helpers/canvas/instance-sizing.ts'
  ).build('createInstanceResizeScene')
  await showView(page, { zoom: 1, panX: 0, panY: 0 })
  return {
    select(...layers: (keyof typeof nodes)[]) {
      return page.evaluate(
        (ids) => window.openPencil?.getStore?.().select(ids),
        layers.map((layer) => nodes[layer])
      )
    }
  }
}
