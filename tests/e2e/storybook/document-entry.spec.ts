import { expect, test } from '@playwright/test'

test('a document entry with a menu takes its parent directives, shows its preview, and deletes from the context menu', async ({
  page
}) => {
  await page.goto('/iframe.html?id=app-home-document-entry--with-menu-and-directive&viewMode=story')
  const entry = page.locator('[data-slot="document-entry"]')
  await expect(entry).toHaveAttribute('data-preview-requested', 'true')

  const preview = entry.locator('[data-slot="preview"] img')
  await expect(preview).toBeVisible()
  expect(await preview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(16)

  await entry.locator('[data-slot="trigger"]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(page.locator('[data-deleted="true"]')).toHaveCount(1)
})
