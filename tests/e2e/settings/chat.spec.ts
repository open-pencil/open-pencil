import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('chat step limit validates, persists and preserves reasoning preferences', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  async function openChatSettings() {
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
    await page.getByRole('tab', { name: 'AI & agents', exact: true }).click()
  }
  await openChatSettings()
  const limit = page.getByRole('spinbutton', { name: 'Maximum steps per message' })
  await expect(limit).toHaveValue('50')
  for (const invalid of ['', '0', '1.5', '1001']) {
    await limit.fill(invalid)
    await limit.press('Enter')
    await expect(limit).toHaveAttribute('aria-invalid', 'true')
    await expect(limit).toHaveAccessibleDescription(/Enter a whole number from 1 to 1000/)
  }
  await limit.fill('200')
  await limit.press('Enter')
  await expect(limit).toHaveAttribute('aria-invalid', 'false')
  const reasoning = page.getByRole('combobox', { name: 'Reasoning display' })
  await reasoning.click()
  await page.getByRole('option', { name: 'Expanded by default', exact: true }).click()
  await page.reload()
  await canvas.waitForInit()
  await openChatSettings()
  await expect(limit).toHaveValue('200')
  await expect(reasoning).toHaveText('Expanded by default')
  await limit.fill('125')
  await reasoning.click()
  await page.keyboard.press('Escape')
  await page.reload()
  await canvas.waitForInit()
  await openChatSettings()
  await expect(limit).toHaveValue('125')
  await expect(reasoning).toHaveText('Expanded by default')
  // An invalid draft must not overwrite the last valid saved preference.
  await limit.fill('0')
  await limit.press('Enter')
  await expect(limit).toHaveAttribute('aria-invalid', 'true')
  await page.reload()
  await canvas.waitForInit()
  await openChatSettings()
  await expect(limit).toHaveValue('125')
})
