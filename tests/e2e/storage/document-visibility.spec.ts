import { readFileSync } from 'node:fs'

import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

// Same budget as workspace.spec.ts: this configures storage, imports a
// document and initialises CanvasKit before asserting, which the 15s default
// makes flaky by duration rather than by behaviour.
test.setTimeout(60_000)

/**
 * A bucket that answers every request with an empty listing.
 *
 * The reported machine's active provider held nothing while the device held
 * forty documents, and that is exactly the state that rendered "No stored
 * documents yet."
 */
async function routeEmptyBucket(page: Page): Promise<void> {
  await page.route('https://s3.example.com/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('list-type') === '2') {
      await route.fulfill({
        contentType: 'application/xml',
        body: '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>'
      })
      return
    }
    await route.fulfill({ status: 404 })
  })
}

async function importLocalDocument(page: Page, name: string): Promise<void> {
  await page.getByTestId('storage-import-input').setInputFiles({
    name,
    mimeType: 'application/octet-stream',
    buffer: readFileSync('tests/fixtures/gold-preview.fig')
  })
}

/**
 * Connect a destination without adopting the documents already on the device.
 *
 * Backup is paused first: promotion is what would otherwise pin the local-only
 * row to the new bucket, and this test needs a document that has no
 * destination WHILE a provider is active — the combination that was
 * unreachable through the UI.
 */
async function connectStorageWithBackupPaused(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).last().click()
  await page.getByTestId('settings-section-storage').click()
  await page.getByTestId('settings-storage-backup-toggle').click()
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
}

test('a document with no destination stays listed while a provider is active', async ({ page }) => {
  await routeEmptyBucket(page)
  await page.goto('/storage?test')
  await expect(page.getByTestId('storage-workspace')).toBeVisible()

  // Written before any destination existed, so the row carries no target.
  await importLocalDocument(page, 'On my laptop.fig')
  const card = page.getByRole('button', { name: 'On my laptop' })
  await expect(card).toBeVisible()
  await expect(card.locator('[data-slot="storage-document-location"]')).toHaveAttribute(
    'data-location',
    'device-only'
  )

  await connectStorageWithBackupPaused(page)

  // The bucket lists nothing. The document is still the user's document.
  await expect(card).toBeVisible()
  await expect(page.getByText('This device holds no documents yet.')).toBeHidden()
  await expect(card.locator('[data-slot="storage-document-location"]')).toHaveAttribute(
    'data-location',
    'device-only'
  )

  // And it opens from local bytes rather than reaching for the active target.
  await card.click()
  await expect(page).toHaveURL(/\/editor$/)
  await new CanvasHelper(page).waitForInit()
})

test('narrowing the scope reports the documents it is hiding', async ({ page }) => {
  await routeEmptyBucket(page)
  await page.goto('/storage?test')
  await expect(page.getByTestId('storage-workspace')).toBeVisible()
  await importLocalDocument(page, 'On my laptop.fig')
  await expect(page.getByRole('button', { name: 'On my laptop' })).toBeVisible()

  await connectStorageWithBackupPaused(page)

  // Scoping is a view the user chooses…
  await page.getByTestId('storage-scope').click()
  await page.getByRole('option', { name: 'This provider' }).click()
  await expect(page.getByRole('button', { name: 'On my laptop' })).toBeHidden()
  // …and an empty list has to say which emptiness it means.
  await expect(page.getByTestId('storage-scope-empty')).toBeVisible()

  await page.getByTestId('storage-scope-show-all').click()
  await expect(page.getByRole('button', { name: 'On my laptop' })).toBeVisible()
})
