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
  await expect(page.getByText('No recent files yet')).toBeVisible()
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

test('the start page shows one list at a time and filters it by file type', async ({ page }) => {
  await page.goto('/?recent-files')
  const home = page.getByTestId('recent-files-home')
  await expect(home.getByRole('heading', { name: 'Recents' })).toBeVisible()
  const recent = home.getByRole('tab', { name: 'Recently viewed', exact: true })
  const storage = home.getByRole('tab', { name: 'Storage', exact: true })
  await expect(recent).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('No recent files yet')).toBeVisible()

  await storage.click()
  await expect(storage).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('No recent files yet')).toBeHidden()
  await expect(page.getByText('Configure storage before using this workspace.')).toBeVisible()

  await home.getByRole('combobox', { name: 'File type' }).click()
  await page.getByRole('option', { name: 'Pencil files' }).click()
  await expect(home.getByRole('combobox', { name: 'File type' })).toContainText('Pencil files')
  await page.reload()
  await expect(home.getByRole('tab', { name: 'Storage', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(home.getByRole('combobox', { name: 'File type' })).toContainText('Pencil files')
})
