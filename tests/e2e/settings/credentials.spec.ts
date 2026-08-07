import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('cloud backup remains global across storage providers', async ({ page }) => {
  await page.goto('/?test')
  await expect(page.getByTestId('storage-workspace')).toBeVisible()

  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-storage').click()

  const backupToggle = page.getByTestId('settings-storage-backup-toggle')
  await expect(backupToggle).toBeVisible()
  await expect(backupToggle).toHaveAttribute('data-state', 'checked')
  await expect(page.getByText(/Configure a provider below to start syncing/)).toBeVisible()

  await backupToggle.click()
  await expect(backupToggle).toHaveAttribute('data-state', 'unchecked')

  await page.getByTestId('settings-storage-provider').click()
  await page.getByRole('option', { name: 'Appwrite' }).click()
  await expect(backupToggle).toBeVisible()
  await expect(backupToggle).toHaveAttribute('data-state', 'unchecked')
  await expect(page.getByText(/Paused — documents stay on this device/)).toBeVisible()
})

test('Appwrite setup uses a scoped key and configures storage automatically', async ({ page }) => {
  const requests: Array<{ method: string; project: string; key: string }> = []
  await page.route('https://fra.cloud.appwrite.io/v1/**', async (route) => {
    const request = route.request()
    requests.push({
      method: request.method(),
      project: request.headers()['x-appwrite-project'] ?? '',
      key: request.headers()['x-appwrite-key'] ?? ''
    })
    const url = new URL(request.url())
    if (url.pathname.endsWith('/storage/buckets')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: 1,
          buckets: [{ $id: 'bucket-1', name: 'OpenPencil' }]
        })
      })
      return
    }
    if (url.pathname.endsWith('/files') && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total: 0, files: [] })
      })
      return
    }
    if (request.method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          $id: 'namespace-marker',
          $updatedAt: '2026-08-02T12:00:00.000Z',
          name: 'namespace-marker',
          sizeOriginal: 1
        })
      })
      return
    }
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ type: 'storage_file_not_found', message: 'Not found' })
    })
  })

  await page.goto('/?test')
  await expect(page.getByTestId('storage-workspace')).toBeVisible()

  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-storage').click()
  await page.getByTestId('settings-storage-provider').click()
  await page.getByRole('option', { name: 'Appwrite' }).click()

  await expect(page.locator('[data-slot="storage-provider-icon"]')).toBeVisible()
  await expect(
    page.getByText(/give the Any role Create\/Read\/Update\/Delete permissions/)
  ).toBeVisible()
  await expect(page.getByLabel('Endpoint')).toHaveAttribute(
    'placeholder',
    'https://fra.cloud.appwrite.io/v1'
  )
  await expect(page.getByLabel('Project ID')).toBeVisible()
  await expect(page.getByLabel('Bucket ID', { exact: true })).toBeVisible()
  await expect(page.getByLabel('API key')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy CORS JSON' })).toHaveCount(0)

  await page.getByLabel('Endpoint').fill('https://fra.cloud.appwrite.io/v1')
  await page.getByLabel('Project ID').fill('project-1')
  await page.getByLabel('Bucket ID', { exact: true }).fill('bucket-1')
  const keyField = page.locator('[data-credential="api-key"]')
  await keyField.locator('input').fill('scoped-appwrite-key')
  await keyField.getByRole('button', { name: 'Save' }).click()
  const connect = page.getByTestId('settings-storage-test')
  await expect(connect).toHaveText('Use Appwrite for cloud storage')
  await connect.click()

  await expect(page.getByRole('status')).toContainText('Connected')
  // Connecting is also the commit point. There is no second, below-the-fold
  // "Use provider" action left for the user to discover.
  await expect(connect).toHaveText('Test connection')
  expect(requests.length).toBeGreaterThanOrEqual(4)
  expect(requests.every((request) => request.project === 'project-1')).toBe(true)
  expect(requests.every((request) => request.key === 'scoped-appwrite-key')).toBe(true)
})

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
  await expect(page.getByTestId('storage-workspace')).toBeVisible()

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
  // The final GET is the first workspace listing after this newly connected
  // provider becomes the active destination.
  expect(requests.map((request) => request.method)).toEqual(['HEAD', 'PUT', 'GET', 'GET'])
  expect(requests.every((request) => request.authorization.includes('/de/s3/aws4_request'))).toBe(
    true
  )
})

test('Backblaze B2 setup maps application keys to its regional S3 endpoint', async ({ page }) => {
  const requests: Array<{ method: string; authorization: string }> = []
  await page.route('https://s3.us-west-004.backblazeb2.com/**', async (route) => {
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
  await expect(page.getByTestId('storage-workspace')).toBeVisible()

  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-storage').click()
  await page.getByTestId('settings-storage-provider').click()
  await page.getByRole('option', { name: 'Backblaze B2 (S3)', exact: true }).click()

  await expect(page.getByText(/Browser use requires bucket CORS configuration/)).toBeVisible()
  await expect(page.getByLabel('Bucket')).toHaveAttribute('placeholder', 'your-b2-bucket')
  await expect(page.getByLabel('Endpoint')).toHaveAttribute(
    'placeholder',
    'https://s3.us-west-004.backblazeb2.com'
  )
  await expect(page.getByLabel('Application key ID', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Application key', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy CORS JSON' })).toBeVisible()

  await page.getByLabel('Bucket').fill('openpencil-test')
  await page.getByLabel('Endpoint').fill('https://s3.us-west-004.backblazeb2.com')
  const keyIDField = page.locator('[data-credential="application-key-id"]')
  await keyIDField.locator('input').fill('application-key-id-value')
  await keyIDField.getByRole('button', { name: 'Save' }).click()
  const keyField = page.locator('[data-credential="application-key"]')
  await keyField.locator('input').fill('application-key-value')
  await keyField.getByRole('button', { name: 'Save' }).click()
  await page.getByTestId('settings-storage-test').click()

  await expect(page.getByRole('status')).toContainText('Connected')
  // The final GET is the first workspace listing after this newly connected
  // provider becomes the active destination.
  expect(requests.map((request) => request.method)).toEqual(['HEAD', 'PUT', 'GET', 'GET'])
  expect(
    requests.every((request) => request.authorization.includes('/us-west-004/s3/aws4_request'))
  ).toBe(true)
})

test('storage settings keep secrets behind the credential manager', async ({ page }) => {
  await page.goto('/?test')
  await expect(page.getByTestId('storage-workspace')).toBeVisible()

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
  await expect(page.getByTestId('storage-workspace')).toBeVisible()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-storage').click()
  await expect(page.getByLabel('Endpoint')).toHaveValue('https://s3.example.com')
  await expect(secretField.locator('input')).not.toHaveAttribute('placeholder', /Key saved/)
})

test('model library keeps reusable profiles and role assignments', async ({ page }) => {
  await page.goto('/?test')
  await expect(page.getByTestId('storage-workspace')).toBeVisible()

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
  await expect(page.getByTestId('storage-workspace')).toBeVisible()
  await page.getByTestId('app-settings-trigger').click()
  await expect(page.getByTestId('settings-model-list')).toContainText('Fast model')
  await expect(page.getByTestId('settings-model-list')).toContainText('Vision model')
  await expect(page.getByTestId('settings-model-assignment-fast')).toContainText('Fast model')
  await expect(page.getByTestId('settings-model-assignment-vision')).toContainText('Vision model')
})

test('remembered browser credentials survive reload and clear centrally', async ({ page }) => {
  await page.goto('/editor?new=design&test')
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

  // Settings are reached from the workspace now, not from a gear in the editor.
  // The document stays open behind it, so the tab is the way back.
  await page.getByTestId('app-back-to-workspace').click()
  await page.getByTestId('app-settings-trigger').click()
  await page.locator('[data-model-id]').first().click()
  await page.getByTestId('provider-settings-clear-key').click()
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByTestId('settings-remember-credentials').click()
  await page.getByTestId('app-settings-done').click()

  // A fresh load rather than a reload: we are on the workspace now, and the
  // point of the step is that the cleared key does not survive a page load.
  await page.goto('/editor?new=design&test')
  await canvas.waitForInit()
  await page.getByRole('tab', { name: 'AI' }).click()
  await expect(page.getByTestId('provider-setup-open-settings')).toBeVisible()
})
