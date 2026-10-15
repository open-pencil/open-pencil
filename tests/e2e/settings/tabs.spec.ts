import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { openSettings } from '#tests/helpers/menu'

test('settings tabs associate panels and support vertical keyboard navigation', async ({
  page
}) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await openSettings(page)
  const dialog = page.getByTestId('app-settings-dialog')
  const general = dialog.getByRole('tab', { name: 'General', exact: true })
  for (const tab of await dialog.getByRole('tab').all()) {
    await expect(tab).toHaveCSS('cursor', 'pointer')
  }
  await expect(general).toHaveAttribute('aria-selected', 'true')
  await expect(dialog).toHaveScreenshot('settings-tabs-general.png')
  await general.focus()
  await general.press('ArrowDown')
  const toolbar = page.getByTestId('settings-section-toolbar')
  await expect(toolbar).toBeFocused()
  await expect(page.getByTestId('settings-toolbar-panel')).toBeVisible()
  await toolbar.press('ArrowDown')
  const usage = page.getByTestId('settings-section-usage')
  await expect(usage).toBeFocused()
  await expect(dialog.getByRole('tabpanel')).toHaveCount(1)
  await expect(dialog.getByRole('tabpanel')).toHaveAttribute(
    'aria-labelledby',
    (await usage.getAttribute('id')) ?? ''
  )
  // System setup is the first tab, with the services it lists nested under it.
  await usage.press('Home')
  const setup = page.getByTestId('settings-section-setup')
  await expect(setup).toBeFocused()
  await expect(page.getByTestId('settings-service-setup-panel')).toBeVisible()
  await setup.press('ArrowDown')
  await expect(page.getByTestId('settings-section-ai')).toBeFocused()
  await expect(page.getByTestId('settings-ai-panel')).toBeVisible()
  await setup.press('End')
  await expect(page.getByTestId('settings-section-privacy')).toBeFocused()
  await page.getByTestId('app-settings-done').click()
  await expect(dialog).not.toBeVisible()
})
