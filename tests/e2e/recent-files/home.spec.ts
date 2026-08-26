import { expect, test } from '@playwright/test'

test('starts on the recent-files home and creates a blank document on demand', async ({ page }) => {
  await page.goto('/?home')

  await expect(page.getByTestId('recent-files-home')).toBeVisible()
  await expect(page.getByText('No recent files yet')).toBeVisible()
  await expect(page.getByTestId('tabbar-tab')).toHaveCount(1)

  await page.getByTestId('home-new-document').click()
  await expect(page.getByTestId('recent-files-home')).toBeHidden()
  await expect(page.getByTestId('canvas-element')).toBeVisible()

  const tab = page.getByTestId('tabbar-tab')
  await expect(tab).toHaveCount(2)

  await page.getByTestId('tabbar-new').click()

  await expect(page.getByTestId('recent-files-home')).toBeVisible()
  await expect(page.getByTestId('tabbar-tab')).toHaveCount(2)
  await expect(page.getByTestId('tabbar-tab').first()).toContainText('Recent files')
  await expect(page.getByTestId('tabbar-close')).toHaveCount(1)

  await page.getByTestId('tabbar-tab').last().click()
  await page.getByTestId('tabbar-tab').last().hover()
  await page.getByTestId('tabbar-tab').last().getByTestId('tabbar-close').click()
  await expect(page.getByTestId('recent-files-home')).toBeVisible()
})

test('shows persisted recent files in grid and list layouts', async ({ page }) => {
  await page.addInitScript(() => {
    const storage = Reflect.get(window, 'localStorage')
    storage.setItem(
      'open-pencil:recent-files',
      JSON.stringify(['/designs/checkout.fig', '/designs/design-system.pen'])
    )
    storage.setItem(
      'open-pencil:recent-file-opened-at',
      JSON.stringify({
        '/designs/checkout.fig': '2026-08-17T12:00:00.000Z',
        '/designs/design-system.pen': '2026-08-16T12:00:00.000Z'
      })
    )
  })
  await page.goto('/?home')

  await expect(page.getByTestId('recent-files-grid')).toBeVisible()
  await expect(page.getByText('checkout.fig')).toBeVisible()
  await expect(page.getByText('design-system.pen')).toBeVisible()

  await page.getByLabel('List view').click()
  await expect(page.getByTestId('recent-files-list')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const storage = Reflect.get(window, 'localStorage')
        return storage.getItem('open-pencil:recent-files-view')
      })
    )
    .toBe('list')
})
