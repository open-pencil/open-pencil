import { expect, test } from '#tests/e2e/fixtures'

test.describe('a populated recent files list', () => {
  test.use({
    storageState: async ({ baseURL }, use) => {
      if (!baseURL) throw new Error('Browser test baseURL is required')
      await use({
        cookies: [],
        origins: [
          {
            origin: new URL(baseURL).origin,
            localStorage: [
              {
                name: 'open-pencil:preferences:v1',
                value: JSON.stringify({ version: 1, onboarding: { aiSetup: 'done' } })
              },
              {
                name: 'open-pencil:recent-documents',
                value: JSON.stringify(
                  Array.from({ length: 12 }, (_, index) => ({
                    id: `local:/design-${index}.fig`,
                    kind: 'local',
                    path: `/design-${index}.fig`,
                    name: `Recent design ${index}`,
                    updatedAt: '2026-01-01T00:00:00.000Z'
                  }))
                )
              }
            ]
          }
        ]
      })
    }
  })

  test('the recent files limit in General settings updates the list and persists', async ({
    page
  }) => {
    await page.goto('/?recent-files')
    await page.getByTestId('recent-files-home').waitFor()
    const documents = page.getByRole('button', { name: /Recent design/ })
    await expect(documents).toHaveCount(10)

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
    const limit = page.getByRole('combobox', { name: 'Number of recent files' })
    await limit.click()
    await page.getByRole('option', { name: '25', exact: true }).click()
    await page.getByTestId('app-settings-done').click()
    await expect(documents).toHaveCount(12)

    await page.reload()
    await expect(documents).toHaveCount(12)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
    await expect(limit).toHaveText('25')
  })
})

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
  await page.locator('[data-slot="tab-item"]').first().getByTestId('tabbar-close').click()

  await expect(page.getByTestId('recent-files-home')).toBeVisible()
})
