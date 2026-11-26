import type { Page } from '@playwright/test'

import type { Vector } from '@open-pencil/scene-graph/primitives'

import { boxOf, buildScene, settle, within } from '../app.ts'
import type { Callout } from '../compose.ts'
import { playlist } from '../scenes.ts'
import { picture, type Shot } from './shared.ts'

/** A number on the picture at a point of an element, moved by `offset`. */
async function marker(
  page: Page,
  number: number,
  testId: string,
  across: number,
  down: number,
  offset: Vector = { x: 0, y: 0 }
): Promise<Callout> {
  const at = within(await boxOf(page.getByTestId(testId).first()), across, down)
  return { number, side: 'on', at: { x: at.x + offset.x, y: at.y + offset.y } }
}

/** Every picture on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  editor: {
    // A small window, so the picture stays legible at the width of the text.
    window: { width: 1024, height: 680 },
    async take(page) {
      await buildScene(page, playlist(), 0.9)
      await page.mouse.move(500, 600)
      await settle(page)
      const window = page.viewportSize()
      if (!window) throw new Error('No window')
      const callouts = [
        await marker(page, 1, 'app-document-name', 1, 0.5, { x: 16, y: 0 }),
        await marker(page, 2, 'pages-add', 0, 0.5, { x: -36, y: 0 }),
        await marker(page, 3, 'layers-header', 0.5, 0.5),
        await marker(page, 4, 'canvas-area', 0.25, 0.2),
        await marker(page, 5, 'toolbar', 0, 0.5, { x: -20, y: 0 }),
        await marker(page, 6, 'properties-tab-design', 0.5, 1, { x: 150, y: 20 }),
        await marker(page, 7, 'zoom-dropdown-trigger', 0, 0.5, { x: -16, y: 0 }),
        await marker(page, 8, 'collab-share-button', 0, 0.5, { x: -18, y: 0 })
      ]
      return picture(page, { x: 0, y: 0, ...window }, 10, { callouts })
    }
  }
}
