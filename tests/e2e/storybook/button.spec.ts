import { expect, test } from '@playwright/test'

test('action buttons keep CJK labels single-line and allow explicit wrapping', async ({ page }) => {
  await page.goto('/iframe.html?id=design-system-actions-button--constrained-labels&viewMode=story')
  const single = page.getByRole('button', { name: '保存设置' })
  await expect(single).toHaveCSS('white-space', 'nowrap')
  const wrapping = page.getByRole('button', { name: 'A deliberately wrapping action label' })
  await expect(wrapping).toHaveCSS('white-space', 'normal')
  await expect(wrapping).toBeVisible()
})
