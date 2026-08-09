import { expect, test, type Route } from '@playwright/test'

/**
 * Backblaze's own host, because Backblaze rejects any endpoint that is not one.
 * Mocking the host it insists on is what lets a non-default provider pass a
 * connection test here at all.
 */
const B2_ORIGIN = 'https://s3.us-west-004.backblazeb2.com'

/**
 * Proving a destination and committing to it are two acts, and the panel has to
 * offer both at once.
 *
 * One morphing button used to do the job: "Test connection" while looking at
 * the active provider, "Use <provider>" while looking at any other. So the
 * order a person actually wants — check it works, then adopt it — was never
 * available, and a passing test repointed sync on its own.
 */
test('adopting a provider needs a passing test of the values on screen', async ({ page }) => {
  await page.route(`${B2_ORIGIN}/**`, async (route: Route) => {
    const request = route.request()
    if (request.method() === 'PUT' || request.method() === 'DELETE') {
      await route.fulfill({ status: 200 })
      return
    }
    if (new URL(request.url()).searchParams.get('list-type') === '2') {
      await route.fulfill({
        contentType: 'application/xml',
        body: '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>'
      })
      return
    }
    await route.fulfill({ status: 404 })
  })

  await page.goto('/storage?test')
  await page.getByRole('button', { name: 'Settings' }).last().click()
  await page.getByTestId('settings-section-storage').click()

  // Load another provider's FORM. Sync still points at the default; only the
  // commit below moves it.
  await page.getByTestId('settings-storage-provider').click()
  await page.getByRole('option', { name: 'Backblaze B2 (S3)' }).click()

  const testConnection = page.getByTestId('settings-storage-test')
  const use = page.getByTestId('settings-storage-use')

  // Both halves of the flow on screen together, and the commit locked with its
  // reason stated next to it.
  await expect(testConnection).toBeEnabled()
  await expect(use).toBeDisabled()
  await expect(page.getByTestId('settings-storage-use-hint')).toBeVisible()

  await page.getByLabel('Endpoint').fill(B2_ORIGIN)
  await page.getByLabel('Bucket').fill('designs')
  for (const [field, value] of [
    ['application-key-id', 'key-id'],
    ['application-key', 'key-secret']
  ] as const) {
    const container = page.locator(`[data-credential="${field}"]`)
    await container.locator('input').fill(value)
    await container.getByRole('button', { name: 'Save' }).click()
  }

  // A complete form is not proof that the bucket answers.
  await expect(use).toBeDisabled()

  await testConnection.click()
  await expect(page.getByTestId('settings-storage-result')).toHaveAttribute('data-state', 'success')
  await expect(use).toBeEnabled()

  // The proof belongs to the values that produced it. Editing one invalidates
  // it, or "tested" would vouch for a bucket nobody has contacted.
  await page.getByLabel('Bucket').fill('designs-elsewhere')
  await expect(use).toBeDisabled()

  await testConnection.click()
  await expect(use).toBeEnabled()
  await use.click()

  // Committed: the primary slot now offers the destination in use, not adoption.
  await expect(page.getByTestId('settings-storage-open-workspace')).toBeVisible()
  await expect(use).toHaveCount(0)
})
