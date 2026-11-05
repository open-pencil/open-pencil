import type { Page } from '@playwright/test'

import type { Vector } from '@open-pencil/scene-graph/primitives'

/** The label centre in page coordinates, including the canvas element's offset. */
export async function statusLabelCenter(page: Page, nodeId: string): Promise<Vector> {
  const center = await page.evaluate((id) => {
    const label = window.openPencil
      ?.getStore?.()
      ?.renderer?.statusLabels.find((entry) => entry.nodeId === id)
    if (!label) {
      throw new Error('Status label not drawn')
    }
    return { x: label.rect.x + label.rect.width / 2, y: label.rect.y + label.rect.height / 2 }
  }, nodeId)
  const canvas = await page.getByTestId('canvas-area').boundingBox()
  if (!canvas) throw new Error('Canvas has no bounding box')
  return { x: canvas.x + center.x, y: canvas.y + center.y }
}
