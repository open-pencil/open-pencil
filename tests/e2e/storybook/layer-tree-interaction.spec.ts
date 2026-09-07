import { expect, test } from '@playwright/test'

test('virtualized rename preserves geometry and selection follows tree focus', async ({ page }) => {
  await page.goto(
    '/iframe.html?id=editor-layer-tree--virtualized&viewMode=story&globals=theme:light'
  )
  const row = page.getByRole('treeitem').first()
  await row.click()
  await expect(row.locator('[data-slot="row"]')).toHaveAttribute('data-focused', 'true')
  await row.locator('[data-slot="label"]').dblclick()
  const input = row.getByRole('textbox')
  await expect(input).toBeFocused()
  await expect(row.locator('[data-slot="rename-row"]')).toHaveCSS('height', '24px')
  await input.fill('Renamed layer')
  await input.press('Enter')
  await expect(row.locator('[data-slot="label"]')).toHaveText('Renamed layer')
  await expect(row.locator('[data-slot="row"]')).toHaveCSS('height', '24px')
  await row.click()
  await page.getByRole('button', { name: 'Outside tree' }).click()
  await expect(row.locator('[data-slot="row"]')).not.toHaveAttribute('data-focused', 'true')
  await expect(row.locator('[data-slot="row"]')).toHaveAttribute('data-selected', 'true')
})
