import type { Page } from '@playwright/test'

import type * as BlendScenes from '#tests/helpers/canvas/blend/scene'
import { pageScene } from '#tests/helpers/canvas/page-scene'

export function linearBlendDriver(page: () => Page) {
  const scenes = pageScene<typeof BlendScenes>(page, '/tests/helpers/canvas/blend/scene.ts')
  return {
    show: () => scenes.build('createLinearBlendScene')
  }
}
