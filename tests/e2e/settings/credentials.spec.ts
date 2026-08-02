import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('Bunny Storage setup only asks for S3-enabled zone credentials', async ({ page }) => {
  const requests: Array<{ method: string; authorization: string }> = []
  await page.route('https://de-s3.storage.bunnycdn.com/**', async (route) => {
    const request = route.request()
    requests.push({
      method: request.method(),
      authorization: request.headers().authorization ?? ''
    })
    if (request.method() === 'HEAD') {
      await route.fulfill({ status: 404 })
      return
    }
    if (new URL(request.url()).searchParams.get('list-type') === '2') {
      await route.fulfill({
        contentType: 'application/xml',
        body: '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>'
      })
      return
    }
    await route.fulfill({ status: 200 })
  })

  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-storage').click()
  await page.getByTestId('settings-storage-provider').click()
  await page.getByRole('option', { name: 'Bunny Storage' }).click()

  await expect(page.locator('[data-slot="storage-provider-icon"]')).toBeVisible()
  await expect(page.getByText('No CORS setup is needed.')).toBeVisible()
  await expect(page.getByLabel('Storage Zone name')).toBeVisible()
  await expect(page.getByLabel('Endpoint')).toHaveAttribute(
    'placeholder',
    'https://de-s3.storage.bunnycdn.com'
  )
  await expect(page.getByLabel('Storage Zone password')).toBeVisible()
  await expect(page.getByLabel('Access key ID')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Copy CORS JSON' })).toHaveCount(0)

  await page.getByLabel('Storage Zone name').fill('openpencil-test2-s3')
  await page.getByLabel('Endpoint').fill('https://de-s3.storage.bunnycdn.com')
  const passwordField = page.locator('[data-credential="password"]')
  await passwordField.locator('input').fill('storage-zone-password')
  await passwordField.getByRole('button', { name: 'Save' }).click()
  await page.getByTestId('settings-storage-test').click()

  await expect(page.getByRole('status')).toContainText('Connected')
  expect(requests.map((request) => request.method)).toEqual(['HEAD', 'PUT', 'GET'])
  expect(requests.every((request) => request.authorization.includes('/de/s3/aws4_request'))).toBe(
    true
  )
})

test('storage settings keep secrets behind the credential manager', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-storage').click()
  await page.getByLabel('Endpoint').fill('https://s3.example.com')
  await page.getByLabel('Bucket').fill('designs')

  const secretField = page.locator('[data-credential="secret-access-key"]')
  await secretField.locator('input').fill('storage-secret')
  await secretField.getByRole('button', { name: 'Save' }).click()
  await expect(secretField.locator('input')).toHaveValue('')
  await expect(secretField.locator('input')).toHaveAttribute('placeholder', /Key saved/)

  await page.getByTestId('app-settings-done').click()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-storage').click()
  await expect(secretField.locator('input')).toHaveValue('')
  await secretField.getByRole('button', { name: 'Clear' }).click()
  await page.getByTestId('app-settings-done').click()

  await page.reload()
  await canvas.waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-storage').click()
  await expect(page.getByLabel('Endpoint')).toHaveValue('https://s3.example.com')
  await expect(secretField.locator('input')).not.toHaveAttribute('placeholder', /Key saved/)
})

test('model library keeps reusable profiles and role assignments', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-add-model').click()
  await page.getByLabel('Name').fill('Fast model')
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name: 'Google AI' }).click()
  await page.getByLabel('Model ID').click()
  await page.getByRole('option', { name: 'Gemini 3 Flash' }).click()
  await page.getByRole('button', { name: 'Save model' }).click()

  await page.getByTestId('settings-add-model').click()
  await page.getByLabel('Name').fill('Vision model')
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name: 'OpenRouter' }).click()
  await page.getByLabel('Model ID').first().click()
  await page.getByRole('option', { name: 'Kimi K2.5' }).click()
  await page.getByRole('switch', { name: 'Image input' }).click()
  await page.getByRole('button', { name: 'Save model' }).click()

  await page.getByTestId('settings-model-assignment-fast').click()
  await page.getByRole('option', { name: 'Fast model' }).click()
  await page.getByTestId('settings-model-assignment-vision').click()
  await page.getByRole('option', { name: 'Vision model' }).click()
  await page.getByTestId('app-settings-done').click()

  await page.reload()
  await canvas.waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await expect(page.getByTestId('settings-model-list')).toContainText('Fast model')
  await expect(page.getByTestId('settings-model-list')).toContainText('Vision model')
  await expect(page.getByTestId('settings-model-assignment-fast')).toContainText('Fast model')
  await expect(page.getByTestId('settings-model-assignment-vision')).toContainText('Vision model')
})

test('remembered browser credentials survive reload and clear centrally', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  await page.getByRole('tab', { name: 'AI' }).click()
  await page.getByTestId('provider-setup-open-settings').click()

  const remember = page.getByTestId('settings-remember-credentials')
  await expect(remember).toHaveAttribute('data-state', 'checked')
  await expect(page.getByTestId('settings-credential-backend')).toContainText(
    'encrypted browser storage'
  )

  await page.locator('[data-model-id]').first().click()
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name: 'OpenRouter' }).click()
  await page.getByLabel('Name').fill('Claude Sonnet')
  await page.getByTestId('provider-settings-api-key').fill('sk-or-remembered-test-key')
  await page.getByRole('button', { name: 'Save model' }).click()
  await page.getByTestId('app-settings-done').click()
  await expect(page.getByTestId('chat-input')).toBeVisible()

  await page.reload()
  await canvas.waitForInit()
  await page.getByRole('tab', { name: 'AI' }).click()
  await expect(page.getByTestId('chat-input')).toBeVisible()

  await page.getByTestId('app-settings-trigger').click()
  await page.locator('[data-model-id]').first().click()
  await page.getByTestId('provider-settings-clear-key').click()
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByTestId('settings-remember-credentials').click()
  await page.getByTestId('app-settings-done').click()

  await page.reload()
  await canvas.waitForInit()
  await page.getByRole('tab', { name: 'AI' }).click()
  await expect(page.getByTestId('provider-setup-open-settings')).toBeVisible()
})
