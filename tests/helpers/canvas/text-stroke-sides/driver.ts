import type { Page } from '@playwright/test'

import { pageScene } from '#tests/helpers/canvas/page-scene'
import type * as TextStrokeSideScenes from '#tests/helpers/canvas/text-stroke-sides/scene'

/** Builds saved text with strokes on each side of its glyphs on the open page. */
export function textStrokeSideDriver(page: () => Page) {
  const scenes = pageScene<typeof TextStrokeSideScenes>(
    page,
    '/tests/helpers/canvas/text-stroke-sides/scene.ts'
  )
  return {
    async show() {
      await scenes.build('createTextStrokeSideScene')
    }
  }
}
