import { expect, test } from '@playwright/test'

test('a document entry with a menu takes its parent directives and opens the menu', async ({
  page
}) => {
  await page.goto('/iframe.html?id=app-home-document-entry--with-menu-and-directive&viewMode=story')
  const entry = page.locator('[data-slot="document-entry"]')
  await expect(entry).toHaveAttribute('data-preview-requested', 'true')
  await entry.locator('[data-slot="trigger"]').click({ button: 'right' })
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
})
