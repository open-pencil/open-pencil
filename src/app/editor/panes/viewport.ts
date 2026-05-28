import type { Vector } from '@open-pencil/core/types'

import type { AppCanvasPaneState } from './types'

export function paneScreenCenter(pane: AppCanvasPaneState): Vector {
  return {
    x: pane.viewportWidth / 2,
    y: pane.viewportHeight / 2
  }
}

export function paneCanvasCenter(pane: AppCanvasPaneState): Vector {
  const center = paneScreenCenter(pane)
  return {
    x: (-pane.panX + center.x) / pane.zoom,
    y: (-pane.panY + center.y) / pane.zoom
  }
}
