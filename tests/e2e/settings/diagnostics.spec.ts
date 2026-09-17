import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function openDiagnostics(page: Page) {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
  await page.getByTestId('settings-section-diagnostics').click()
}

async function reloadAndOpenDiagnostics(page: Page) {
  await page.reload()
  await new CanvasHelper(page).waitForInit()
  await openDiagnostics(page)
}

test('diagnostics retention offers presets and accepts a bounded custom value', async ({
  page
}) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await openDiagnostics(page)
  const retention = page.getByRole('combobox', { name: 'Diagnostics retention' })
  await expect(retention).toHaveText('500')

  // A custom value is validated against the supported range before it is kept.
  await retention.click()
  await page.getByRole('option', { name: 'Custom…' }).click()
  const custom = page.getByRole('spinbutton', { name: 'Diagnostics retention' })
  await custom.fill('10')
  await custom.press('Enter')
  await expect(custom).toHaveAttribute('aria-invalid', 'true')
  await expect(custom).toHaveAccessibleDescription(/Enter a whole number from 50 to 20000/)

  await custom.fill('750')
  await custom.press('Enter')
  await expect(custom).toHaveAttribute('aria-invalid', 'false')

  await reloadAndOpenDiagnostics(page)
  await expect(retention).toHaveText('Custom…')
  await expect(page.getByRole('spinbutton', { name: 'Diagnostics retention' })).toHaveValue('750')

  // Presets remain one click and persist without revealing the field.
  await retention.click()
  await page.getByRole('option', { name: '1000', exact: true }).click()
  await expect(retention).toHaveText('1000')
  await reloadAndOpenDiagnostics(page)
  await expect(retention).toHaveText('1000')
  await expect(page.getByRole('spinbutton', { name: 'Diagnostics retention' })).toHaveCount(0)
})
