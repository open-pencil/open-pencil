import { expect, test } from '@playwright/test'

for (const theme of ['light', 'dark']) {
  test(`populated search with trailing action in ${theme}`, async ({ page }) => {
    await page.goto(
      `/iframe.html?id=design-system-inputs-input--default&viewMode=story&globals=theme:${theme}`
    )
    const input = page.getByRole('searchbox', { name: 'Search files' })
    await input.fill('A long file name with a clear action')
    await expect(page.getByRole('button', { name: 'Clear search' })).toBeVisible()
    await expect(page.locator('#storybook-root')).toHaveScreenshot(`populated-search-${theme}.png`)
  })
}

test('conditional trailing content preserves input focus while typing', async ({ page }) => {
  await page.goto('/iframe.html?id=design-system-inputs-input--conditional-trailing&viewMode=story')
  const input = page.getByRole('textbox', { name: 'Conditional trailing input' })
  await input.focus()
  await page.keyboard.type('Continuous typing')
  await expect(input).toHaveValue('Continuous typing')
  await expect(input).toBeFocused()
})

test('adorned search accepts text, clears through its trailing action, and forwards native attributes', async ({
  page
}) => {
  await page.goto('/iframe.html?id=design-system-inputs-input--default&viewMode=story')
  const input = page.getByRole('searchbox', { name: 'Search files' })
  await expect(input).toHaveAttribute('name', 'search')
  await input.fill('Design system')
  await expect(input).toHaveValue('Design system')
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()
  await input.fill('Second search')
  await expect(input).toHaveValue('Second search')
  await page.getByRole('button', { name: 'Focus search', exact: true }).click()
  await expect(input).toBeFocused()
  await page.getByRole('button', { name: 'Select search text' }).click()
  await page.keyboard.type('Replacement')
  await expect(input).toHaveValue('Replacement')
  await expect(page.getByRole('textbox', { name: 'Disabled input' })).toBeDisabled()
  const plain = page.getByRole('textbox', { name: 'Plain input' })
  await plain.fill('Updated')
  await expect(plain).toHaveValue('Updated')
})
