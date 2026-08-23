import { expect, test } from '#tests/e2e/fixtures'

test('keeps the New tab layout usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?recent-files')

  const search = page.getByLabel('Search files…')
  await expect(search).toBeVisible()
  await expect(search).not.toBeFocused()
  await expect(search).toHaveAttribute('placeholder', 'Search files…')
  await expect(page.getByTestId('home-open-file')).toBeVisible()
  await expect(page.getByTestId('home-new-document')).toBeVisible()
  await expect(page.getByTestId('recent-files-home')).toHaveJSProperty(
    'scrollWidth',
    await page.getByTestId('recent-files-home').evaluate((element) => element.clientWidth)
  )
})

test('opens to the recent-files home and starts a new document', async ({ page }) => {
  await page.goto('/?recent-files')

  await expect(page.getByTestId('recent-files-home')).toBeVisible()
  await expect(page.getByText('No recent files yet')).toBeVisible()
  await expect(page.getByTestId('tabbar-tab')).toHaveCount(1)

  await page.getByTestId('home-new-document').click()

  await expect(page.getByTestId('recent-files-home')).toBeHidden()
  const tab = page.getByTestId('tabbar-tab')
  await expect(tab).toHaveCount(1)
  await expect(tab).toContainText('Untitled')
  await expect(page.getByTestId('tabbar-close')).toHaveCount(1)

  await page.getByTestId('tabbar-new').click()

  await expect(page.getByTestId('recent-files-home')).toBeVisible()
  await expect(page.getByTestId('tabbar-tab')).toHaveCount(2)
  await expect(page.getByTestId('tabbar-tab').last()).toContainText('New tab')
  await expect(page.getByLabel('Search files…')).toBeFocused()
  await expect(page.getByTestId('tabbar-close')).toHaveCount(2)

  await page.getByTestId('tabbar-tab').first().click()
  await page.getByTestId('tabbar-tab').first().hover()
  await page.getByTestId('tabbar-tab').first().getByTestId('tabbar-close').click()

  await expect(page.getByTestId('recent-files-home')).toBeVisible()
})
