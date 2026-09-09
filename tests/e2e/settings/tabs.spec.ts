import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('settings tabs associate panels and support vertical keyboard navigation', async ({
  page
}) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  const dialog = page.getByTestId('app-settings-dialog')
  const general = dialog.getByRole('tab', { name: 'General', exact: true })
  await expect(general).toHaveAttribute('aria-selected', 'true')
  await expect(dialog).toHaveScreenshot('settings-tabs-general.png')
  await general.focus()
  await general.press('ArrowDown')
  const ai = page.getByTestId('settings-section-ai')
  await expect(ai).toBeFocused()
  await expect(ai).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByRole('tabpanel')).toHaveCount(1)
  await expect(page.getByTestId('settings-ai-panel')).toBeVisible()
  await expect(dialog.getByRole('tabpanel')).toHaveAttribute(
    'aria-labelledby',
    (await ai.getAttribute('id')) ?? ''
  )
  await ai.press('Home')
  await expect(general).toBeFocused()
  await expect(page.getByTestId('settings-general-panel')).toBeVisible()
  await general.press('End')
  await expect(page.getByTestId('settings-section-storage')).toBeFocused()
  await page.getByTestId('app-settings-done').click()
  await expect(dialog).not.toBeVisible()
})
