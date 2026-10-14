import { expect, test } from '#tests/e2e/fixtures'

test('keeps the start page layout usable on mobile', async ({ page }) => {
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

  // The start page has the home button, as in Figma's desktop app; tabs list designs only.
  const home = page.getByTestId('tabbar-home')
  await expect(page.getByTestId('recent-files-home')).toBeVisible()
  await expect(page.getByText('No designs yet')).toBeVisible()
  await expect(home).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('tabbar-tab')).toHaveCount(0)

  await page.getByTestId('home-new-document').click()

  await expect(page.getByTestId('recent-files-home')).toBeHidden()
  const tab = page.getByTestId('tabbar-tab')
  await expect(tab).toHaveCount(1)
  await expect(tab).toContainText('Untitled')
  await expect(home).toHaveAttribute('aria-pressed', 'false')

  await home.click()

  await expect(page.getByTestId('recent-files-home')).toBeVisible()
  await expect(page.getByTestId('tabbar-tab')).toHaveCount(1)
  await expect(home).toHaveAttribute('aria-pressed', 'true')

  await page.getByTestId('tabbar-tab').first().click()
  await expect(page.getByTestId('recent-files-home')).toBeHidden()
  await page.getByTestId('tabbar-tab').first().hover()
  await page.locator('[data-slot="tab-item"]').first().getByTestId('tabbar-close').click()

  await expect(page.getByTestId('recent-files-home')).toBeVisible()
  await expect(page.getByTestId('tabbar-tab')).toHaveCount(0)
})
