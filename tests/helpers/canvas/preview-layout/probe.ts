import type { Page } from '@playwright/test'

import type { Rect } from '@open-pencil/scene-graph/primitives'

/** Where a top-level layer's preview island puts one of its layers, without the canvas zoom. */
export function previewBox(page: Page, islandId: string, name: string): Promise<Rect> {
  return page
    .locator(`[data-island="${islandId}"] [data-layer$="${name}"]`)
    .evaluate((element: HTMLElement) => {
      const parent = element.parentElement
      if (!parent) throw new Error('The layer has no parent')
      const at = element.getBoundingClientRect()
      const from = parent.getBoundingClientRect()
      // The frame's width is whole; a text's is not, and `offsetWidth` rounds it.
      const zoom = from.width / parent.offsetWidth
      return {
        x: Math.round((at.left - from.left) / zoom),
        y: Math.round((at.top - from.top) / zoom),
        width: element.offsetWidth,
        height: element.offsetHeight
      }
    })
}

/** The size preview gives the island's own layer. */
export function previewSize(
  page: Page,
  islandId: string
): Promise<{ width: number; height: number }> {
  return page
    .locator(`[data-island="${islandId}"] [data-layer]`)
    .first()
    .evaluate((element: HTMLElement) => ({
      width: element.offsetWidth,
      height: element.offsetHeight
    }))
}
