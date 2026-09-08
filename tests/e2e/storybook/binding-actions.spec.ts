import { expect, test } from '@playwright/test'

test('binding picker creates a variable through submit and detaches it', async ({ page }) => {
  await page.goto('/iframe.html?id=editor-properties-binding-field--picker-actions&viewMode=story')
  const field = page.getByLabel('Unbound field', { exact: true })
  await field.getByRole('button', { name: 'Apply variable' }).click()
  await page.getByRole('button', { name: 'Create number variable' }).click()
  const input = page.getByPlaceholder('Variable name')
  await expect(input).toBeFocused()
  const create = page.getByRole('button', { name: 'Create', exact: true })
  await expect(create).toBeDisabled()
  await input.fill('New spacing')
  await create.click()
  await expect(field).toHaveAttribute('data-bound')
  await field.getByRole('button', { name: 'Apply variable' }).click()
  await page.getByRole('button', { name: 'Detach variable' }).click()
  await expect(field).toHaveAttribute('data-unbound')
})
