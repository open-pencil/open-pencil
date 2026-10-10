import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('Appearance groups theme and animation controls and uses the persisted app theme', async ({
  page
}) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  const appearance = page.getByRole('region', { name: 'Appearance', exact: true })
  await expect(appearance.getByRole('combobox', { name: 'Animations', exact: true })).toBeVisible()
  const theme = appearance.getByRole('combobox', { name: 'Theme', exact: true })
  await theme.click()
  await page.getByRole('option', { name: 'Light', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('html')).toHaveAttribute('data-theme-setting', 'light')
  await page.reload()
  await canvas.waitForInit()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByTestId('app-settings-trigger').click()
  await expect(theme).toHaveText('Light')
  await theme.click()
  await page.getByRole('option', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await theme.click()
  await page.getByRole('option', { name: 'Auto', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme-setting', 'auto')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('Accent color recolors the interface, persists, and a cancelled custom pick restores it', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const accent = () =>
    page.evaluate(() => document.documentElement.style.getPropertyValue('--color-accent'))
  const initial = await accent()

  await page.getByTestId('app-settings-trigger').click()
  const presets = page.getByRole('radiogroup', { name: 'Accent color', exact: true })
  const green = presets.getByRole('radio', { name: 'Green', exact: true })
  await green.click()
  await expect(green).toBeChecked()
  await expect.poll(accent).not.toBe(initial)
  const chosen = await accent()

  await page.reload()
  await canvas.waitForInit()
  await expect.poll(accent).toBe(chosen)

  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-accent-custom').click()
  const red = page.getByRole('spinbutton', { name: 'Red', exact: true })
  await red.fill('0')
  await red.press('Enter')
  await expect(page.getByTestId('settings-accent-custom')).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(accent).not.toBe(chosen)
  await page.keyboard.press('Escape')
  await expect.poll(accent).toBe(chosen)
  await expect(green).toBeChecked()
})
