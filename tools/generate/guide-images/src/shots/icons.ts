import { boxOf, settle } from '../app.ts'
import { picture, type Shot } from './shared.ts'

/** Every picture on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  picker: {
    async take(page) {
      await page.getByTestId('menubar-object').click()
      await page.getByRole('menuitem', { name: 'Insert Icon…' }).click()
      const dialog = page.getByRole('dialog').last()
      await dialog.getByRole('textbox').first().fill('heart')
      // Results come from the Iconify API.
      await dialog.getByRole('option').nth(11).waitFor()
      await page.mouse.move(5, 5)
      await settle(page)
      const box = await boxOf(dialog)
      const clip = { x: box.x + 1, y: box.y + 1, width: box.width - 2, height: box.height - 2 }
      return picture(page, clip, 14)
    }
  }
}
