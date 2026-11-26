import type { Page } from '@playwright/test'

import { boxOf, buildScene, layerBox, settle, within } from '../app.ts'
import type { Picture } from '../compose.ts'
import { playlist } from '../scenes.ts'
import { callout, menuPicture, panelClip, picture, PANEL_RADIUS, type Shot } from './shared.ts'

async function copyMenu(page: Page): Promise<Picture> {
  await buildScene(page, playlist())
  const corner = within(await layerBox(page, ['Playlist']), 0.03, 0.03)
  await page.mouse.click(corner.x, corner.y, { button: 'right' })
  await page.getByTestId('context-copy-paste-as').hover()
  await settle(page)
  return menuPicture(page)
}

/** The pictures on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  panel: {
    async take(page) {
      await buildScene(page, playlist())
      const add = page.getByRole('button', { name: 'Add export' })
      await add.click()
      await add.click()
      const toggle = page.getByRole('button', { name: 'Preview', exact: true }).first()
      await toggle.click()
      const preview = page.locator('img[src^="blob:"]').last()
      await preview.waitFor()
      // The preview's section slides open, and scrolling must wait for its full height.
      await settle(page)
      await preview.evaluate((image) => image.scrollIntoView({ block: 'center' }))
      await page.mouse.move(700, 120)
      await settle(page)
      const clip = await panelClip(page, 'Export', await boxOf(preview))
      const scale = page.locator('[data-property="export-scale"]').first().locator('xpath=..')
      const format = page.locator('[data-property="export-format"]').first()
      const callouts = [
        await callout(clip, 1, 'left', scale),
        // Above the middle, where the row's remove button is.
        await callout(clip, 2, 'right', format, 0.2),
        await callout(clip, 3, 'left', page.getByTestId('export-button')),
        await callout(clip, 4, 'left', toggle)
      ]
      return picture(page, clip, PANEL_RADIUS, { callouts })
    }
  },
  'copy-as': { take: copyMenu },
  'copy-as-other': { keyboard: 'other', take: copyMenu }
}
