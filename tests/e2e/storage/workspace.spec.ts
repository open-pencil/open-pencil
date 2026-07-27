import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('configured storage lists and opens a remote document', async ({ page }) => {
  const fixture = readFileSync('tests/fixtures/gold-preview.fig')
  await page.route('https://s3.example.com/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('list-type') === '2') {
      await route.fulfill({
        contentType: 'application/xml',
        body: `<ListBucketResult>
          <IsTruncated>false</IsTruncated>
          <Contents>
            <Key>open_pencil_storage/canvases/remote-1.fig</Key>
            <LastModified>2026-01-02T03:04:05.000Z</LastModified>
            <Size>${fixture.byteLength}</Size>
          </Contents>
        </ListBucketResult>`
      })
      return
    }
    if (url.pathname.endsWith('/remote-1.meta.json')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ name: 'Remote design', updatedAt: '2026-01-02T03:04:05.000Z' })
      })
      return
    }
    if (url.pathname.endsWith('/remote-1.fig')) {
      await route.fulfill({ contentType: 'application/octet-stream', body: fixture })
      return
    }
    await route.fulfill({ status: 404 })
  })

  await page.goto('/storage?test')
  const canvas = new CanvasHelper(page)
  await page.getByRole('button', { name: 'Settings' }).last().click()
  await page.getByLabel('Endpoint').fill('https://s3.example.com')
  await page.getByLabel('Bucket').fill('designs')

  for (const [field, value] of [
    ['access-key-id', 'access-key'],
    ['secret-access-key', 'secret-key']
  ] as const) {
    const container = page.locator(`[data-credential="${field}"]`)
    await container.locator('input').fill(value)
    await container.getByRole('button', { name: 'Save' }).click()
  }

  await page.getByTestId('settings-storage-open-workspace').click()
  await expect(page.getByTestId('storage-workspace')).toBeVisible()
  await expect(page.getByText('Remote design')).toBeVisible()

  await page.locator('[data-document-id="remote-1"]').click()
  await expect(page).toHaveURL(/\/$/)
  await canvas.waitForInit()
  await expect(page.getByText('Remote design').first()).toBeVisible()
})

test('storage workspace directs unconfigured users to Settings', async ({ page }) => {
  await page.goto('/storage?test')

  await expect(page.getByTestId('storage-workspace')).toBeVisible()
  await expect(page.getByText('Configure storage before using this workspace.')).toBeVisible()
  await expect(page.getByTestId('storage-new-document')).toBeDisabled()

  await page.getByRole('button', { name: 'Settings' }).last().click()
  await expect(page.getByTestId('settings-storage-panel')).toBeVisible()
})
