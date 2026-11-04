import type { Page } from '@playwright/test'

import type * as EffectScenes from '#tests/helpers/canvas/effects/scene'
import { pageScene } from '#tests/helpers/canvas/page-scene'

const scenes = (page: () => Page) =>
  pageScene<typeof EffectScenes>(page, '/tests/helpers/canvas/effects/scene.ts')

/** Builds the blur effects scene on the open page and leaves it unselected for a snapshot. */
export function blurEffectsDriver(page: () => Page) {
  return {
    show: () => scenes(page).build('createBlurEffectsScene')
  }
}

/** Builds the shadow silhouette scene on the open page and leaves it unselected for a snapshot. */
export function shadowSilhouetteDriver(page: () => Page) {
  return {
    show: () => scenes(page).build('createShadowSilhouetteScene')
  }
}
