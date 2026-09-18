import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function openChatSettings(page: Page) {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
  await page.getByTestId('settings-section-ai').click()
}

async function reloadAndOpenChatSettings(page: Page) {
  await page.reload()
  await new CanvasHelper(page).waitForInit()
  await openChatSettings(page)
}

test('chat step limit validates, persists and preserves reasoning preferences', async ({
  page
}) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await openChatSettings(page)
  // The control must sit in a row that names it; an accessible name alone left
  // it unlabeled in the panel.
  const row = page
    .locator('[data-slot="settings-row"]')
    .filter({ hasText: 'Maximum steps per message' })
  await expect(row).toContainText('For built-in AI only')
  const limit = row.getByRole('combobox', { name: 'Maximum steps per message' })
  await expect(limit).toHaveText('50')
  // The numeric field only appears behind the custom option.
  await expect(row.getByRole('spinbutton')).toHaveCount(0)
  await limit.click()
  await page.getByRole('option', { name: 'Custom…' }).click()

  const custom = row.getByRole('spinbutton', { name: /Maximum steps per message/ })
  for (const invalid of ['', '0', '1.5', '1001']) {
    await custom.fill(invalid)
    await custom.press('Enter')
    await expect(custom).toHaveAttribute('aria-invalid', 'true')
    await expect(custom).toHaveAccessibleDescription(/Enter a whole number from 1 to 1000/)
  }

  await custom.fill('137')
  await custom.press('Enter')
  await expect(custom).toHaveAttribute('aria-invalid', 'false')

  const reasoning = page.getByRole('combobox', { name: 'Reasoning display' })
  await reasoning.click()
  await page.getByRole('option', { name: 'Expanded by default', exact: true }).click()

  await reloadAndOpenChatSettings(page)
  // A value outside the presets keeps the custom option selected.
  await expect(limit).toHaveText('Custom…')
  await expect(row.getByRole('spinbutton', { name: /Maximum steps per message/ })).toHaveValue(
    '137'
  )
  await expect(reasoning).toHaveText('Expanded by default')

  // A preset commits without revealing the field, and an invalid draft is not saved.
  await limit.click()
  await page.getByRole('option', { name: '200', exact: true }).click()
  await expect(limit).toHaveText('200')
  await reloadAndOpenChatSettings(page)
  await expect(limit).toHaveText('200')
})
