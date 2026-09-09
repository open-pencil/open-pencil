import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('keyboard switches document tabs and middle-click closes an inactive tab', async ({
  page
}) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.getByTestId('tabbar-new').click()
  const tabs = page.getByTestId('tabbar-tab')
  await tabs.first().focus()
  await tabs.first().press('ArrowRight')
  await expect(tabs.last()).toBeFocused()
  await expect(tabs.last()).toHaveAttribute('aria-selected', 'true')
  await tabs.first().click({ button: 'middle' })
  await expect(tabs).toHaveCount(1)
  await expect(page.getByTestId('recent-files-home')).toBeVisible()
})

test('closing an inactive document tab does not select it', async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.getByTestId('tabbar-new').click()
  const tabs = page.getByRole('tablist').filter({ has: page.getByTestId('tabbar-tab') })
  await expect(tabs.getByRole('tab')).toHaveCount(2)
  await expect(tabs.getByRole('tab').last()).toHaveAttribute('aria-selected', 'true')
  await page.locator('[data-slot="tab-item"]').first().hover()
  await page
    .locator('[data-slot="tab-item"]')
    .first()
    .getByRole('button', { name: /Close/ })
    .click()
  await expect(tabs.getByRole('tab')).toHaveCount(1)
  await expect(page.getByTestId('recent-files-home')).toBeVisible()
})
