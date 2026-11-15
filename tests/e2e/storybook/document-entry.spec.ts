import { expect, test } from '@playwright/test'

test('a document entry with a menu takes its parent directives, shows its preview, and deletes from the context menu', async ({
  page
}) => {
  await page.goto('/iframe.html?id=app-home-document-entry--with-menu-and-directive&viewMode=story')
  const entry = page.locator('[data-slot="document-entry"]')
  await expect(entry).toHaveAttribute('data-preview-requested', 'true')

  const preview = entry.locator('[data-slot="preview"] img')
  await expect(preview).toBeVisible()
  await expect(preview).toHaveJSProperty('naturalWidth', 16)

  await entry.locator('[data-slot="trigger"]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(page.locator('[data-deleted="true"]')).toHaveCount(1)
})

test('a right-click anywhere on a list entry opens its context menu', async ({ page }) => {
  await page.goto('/iframe.html?id=app-home-document-entry--list-with-menu&viewMode=story')
  const entry = page.locator('[data-slot="document-entry"]')
  const box = await entry.boundingBox()
  if (!box) throw new Error('The entry has no box')
  // The gap right of the ⋯ button belongs to no control, only to the row.
  await entry.click({ button: 'right', position: { x: box.width - 2, y: box.height / 2 } })
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
})
