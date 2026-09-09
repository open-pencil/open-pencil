import { expect, test } from '@playwright/test'

test('virtualized rename commits and selection persists outside the tree', async ({ page }) => {
  await page.goto(
    '/iframe.html?id=editor-layer-tree--virtualized&viewMode=story&globals=theme:light'
  )
  const row = page.getByRole('treeitem').first()
  await row.focus()
  await row.locator('[data-slot="label"]').dblclick()
  const input = row.getByRole('textbox')
  await expect(input).toBeFocused()
  await input.fill('Renamed layer')
  await input.press('Enter')
  await expect(row.locator('[data-slot="label"]')).toHaveText('Renamed layer')
  await row.focus()
  await expect(row).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Outside tree' }).click()
  await expect(page.getByRole('button', { name: 'Outside tree' })).toBeFocused()
  await expect(row).toHaveAttribute('aria-selected', 'true')
})
