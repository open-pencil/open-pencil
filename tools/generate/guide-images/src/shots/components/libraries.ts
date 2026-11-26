import { boxOf, buildScene, settle } from '#guide-images/app'
import { buttons } from '#guide-images/scenes'
import { picture, type Shot } from '#guide-images/shots/shared'

/** Every picture on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  publish: {
    async take(page) {
      await buildScene(page, buttons())
      await page.getByTestId('left-panel-assets-tab').click()
      await page.getByRole('button', { name: 'Manage libraries' }).click()
      await page.getByRole('button', { name: 'Publish library' }).first().click()
      const dialog = page.getByRole('dialog').last()
      await dialog.getByLabel('Library ID').fill('acme-ui')
      await dialog.getByLabel('Library name').fill('Acme UI')
      // Leave the fields without focus, so none is highlighted.
      await dialog.getByRole('heading').first().click()
      await page.mouse.move(10, 10)
      await settle(page)
      const box = await boxOf(dialog)
      const clip = { x: box.x + 1, y: box.y + 1, width: box.width - 2, height: box.height - 2 }
      return picture(page, clip, 14)
    }
  }
}
