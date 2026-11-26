import { boxOf, settle } from '../app.ts'
import { PANEL_RADIUS, picture, type Shot } from './shared.ts'

/** The pictures on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  'open-url': {
    async take(page) {
      await page.getByRole('menuitem', { name: 'File', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Open from URL…' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('textbox').fill('https://example.com')
      await settle(page)
      const box = await boxOf(dialog)
      const clip = { x: box.x + 1, y: box.y + 1, width: box.width - 2, height: box.height - 2 }
      return picture(page, clip, PANEL_RADIUS)
    }
  }
}
