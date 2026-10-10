import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import {
  toolbarFlyoutItemTestId,
  toolbarFlyoutTestId,
  toolbarToolTestId
} from '#tests/helpers/test-ids'

/** The tools the toolbar shows, in order: a flyout counts as the tool its button shows. */
function toolbarOrder(page: Page) {
  return page
    .getByTestId('toolbar')
    .locator('button[aria-pressed]')
    .evaluateAll((buttons) =>
      buttons.flatMap((button) => button.getAttribute('data-test-id') ?? [])
    )
}

test('the toolbar hides, reorders and regroups tools from Settings and keeps the layout', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await page.getByTestId('toolbar').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Customize toolbar…' }).click()
  const settings = page.getByTestId('settings-toolbar-panel')
  await expect(settings).toBeVisible()

  await settings.getByRole('switch', { name: 'Show Pen' }).click()
  // Dropping Comment onto Hand puts both in one menu; Text's grip moves it with the keyboard.
  await settings
    .getByRole('button', { name: 'Reorder Comment' })
    .dragTo(settings.locator('[data-entry="HAND"]'))
  await settings.getByRole('button', { name: 'Reorder Text' }).press('ArrowUp')
  await page.getByTestId('app-settings-done').click()
  await expect(page.getByTestId('app-settings-dialog')).toBeHidden()

  const expectCustomized = async () => {
    await expect(page.getByTestId(toolbarToolTestId('PEN'))).toHaveCount(0)
    expect(await toolbarOrder(page)).toEqual(
      (['SELECT', 'FRAME', 'RECTANGLE', 'TEXT', 'HAND'] as const).map((tool) =>
        toolbarToolTestId(tool)
      )
    )
    await page.getByTestId(toolbarFlyoutTestId('HAND')).click()
    await page.getByTestId(toolbarFlyoutItemTestId('COMMENT')).click()
    await expect(page.getByTestId(toolbarToolTestId('COMMENT'))).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  }
  await expectCustomized()

  await page.reload()
  await canvas.waitForInit()
  await expectCustomized()

  await canvas.pressKey('p')
  expect(await page.evaluate(() => window.openPencil?.getStore?.().state.activeTool)).toBe('PEN')

  await page.getByTestId('toolbar').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Customize toolbar…' }).click()
  await page.getByRole('button', { name: 'Reset to default' }).click()
  await page.getByTestId('app-settings-done').click()
  await expect(page.getByTestId(toolbarToolTestId('PEN'))).toBeVisible()
  canvas.assertNoErrors()
})
