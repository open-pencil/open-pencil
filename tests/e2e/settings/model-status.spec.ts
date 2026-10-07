import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function openModels(page: Page) {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-ai').click()
}

test('an unreadable saved key marks its model row instead of failing Settings', async ({
  page
}) => {
  await openModels(page)
  await page.locator('[data-model-id]').first().click()
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name: 'OpenRouter' }).click()
  await page.getByTestId('provider-settings-api-key').fill('sk-or-unreadable')
  await page.getByRole('button', { name: 'Save model' }).click()
  await expect(page.getByTestId('settings-model-list')).toContainText('Connected')

  // A stored key that can no longer be decrypted, as after browser data from an older session.
  await page.addInitScript(() => {
    crypto.subtle.decrypt = () => Promise.reject(new DOMException('', 'OperationError'))
  })
  await openModels(page)
  const row = page.getByTestId('settings-model-list').locator('[data-model-id]').first()
  await expect(row).toContainText('Unavailable')
  await expect(page.getByText('Browser credential operation failed')).toHaveCount(0)
})
