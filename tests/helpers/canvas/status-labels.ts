import type { Page } from '@playwright/test'

import type { Vector } from '@open-pencil/scene-graph/primitives'

export function statusLabelCenter(page: Page, nodeId: string): Promise<Vector> {
  return page.evaluate((id) => {
    const label = window.openPencil
      ?.getStore?.()
      ?.renderer?.statusLabels.find((entry) => entry.nodeId === id)
    if (!label) {
      throw new Error('Status label not drawn')
    }
    return { x: label.rect.x + label.rect.width / 2, y: label.rect.y + label.rect.height / 2 }
  }, nodeId)
}
