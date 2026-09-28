import { expect, test } from '@playwright/test'

test('determinate progress exposes its value and bar width', async ({ page }) => {
  await page.goto('/iframe.html?id=design-system-toast--download-progress&viewMode=story')

  const toast = page.locator('[data-slot="toast"]')
  await expect(toast).toHaveAttribute('data-progress', 'determinate')
  await expect(toast.locator('[data-slot="toast-progress-label"]')).toHaveText(
    '42% · 9.6 MiB of 22.9 MiB'
  )

  const bar = toast.getByRole('progressbar')
  await expect(bar).toHaveAttribute('aria-valuenow', '42')
  await expect(bar).toHaveAttribute('aria-valuemin', '0')
  await expect(bar).toHaveAttribute('aria-valuemax', '100')
  await expect(toast.locator('[data-slot="toast-progress-fill"]')).toHaveAttribute(
    'style',
    /width: 42%/
  )
})

test('progress without a known total stays indeterminate', async ({ page }) => {
  await page.goto(
    '/iframe.html?id=design-system-toast--download-progress-unknown-total&viewMode=story'
  )

  const toast = page.locator('[data-slot="toast"]')
  await expect(toast).toHaveAttribute('data-progress', 'indeterminate')
  await expect(toast.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow', /\d/)
  await expect(toast.locator('[data-slot="toast-progress-label"]')).toHaveText('4.2 MiB downloaded')
})

test('a reported total flips between determinate, indeterminate, and cleared', async ({ page }) => {
  await page.clock.install()
  await page.goto('/iframe.html?id=design-system-toast--progress-lifecycle&viewMode=story')

  const toast = page.locator('[data-slot="toast"]')
  const bar = toast.getByRole('progressbar')
  await expect(toast).toHaveAttribute('data-progress', 'determinate')
  await expect(bar).toHaveAttribute('aria-valuenow', '0')

  // The bar follows the reported work and keeps the toast open instead of expiring.
  await page.getByRole('button', { name: 'Advance download' }).click()
  await expect(bar).toHaveAttribute('aria-valuenow', '13')
  await expect(toast.locator('[data-slot="toast-progress-label"]')).toHaveText(
    '13% · 2.9 MiB of 22.9 MiB'
  )
  await page.clock.fastForward(3_500)
  await expect(toast).toBeVisible()

  // Losing the total must drop the value rather than pinning the bar at 13%.
  await page.getByRole('button', { name: 'Unknown total' }).click()
  await expect(toast).toHaveAttribute('data-progress', 'indeterminate')
  await expect(bar).not.toHaveAttribute('aria-valuenow', /\d/)

  // Clearing progress removes the bar and returns the toast to auto-dismissal.
  await page.getByRole('button', { name: 'Clear progress' }).click()
  await expect(toast).toHaveAttribute('data-progress', 'none')
  await expect(toast.getByRole('progressbar')).toHaveCount(0)
  await page.clock.fastForward(3_500)
  await expect(toast).toBeHidden()
})

test('resuming progress cancels the pending auto-dismissal', async ({ page }) => {
  await page.clock.install()
  await page.goto('/iframe.html?id=design-system-toast--progress-lifecycle&viewMode=story')

  const toast = page.locator('[data-slot="toast"]')
  await expect(toast).toHaveAttribute('data-progress', 'determinate')
  await page.getByRole('button', { name: 'Clear progress' }).click()
  await expect(toast).toHaveAttribute('data-progress', 'none')
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(toast).toHaveAttribute('data-progress', 'determinate')

  // Advance beyond the timer installed before progress resumed.
  await page.clock.fastForward(3_500)
  await expect(toast).toBeVisible()
  await page.getByRole('button', { name: 'Advance download' }).click()
  await expect(toast.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '13')
})

test('an action toast renders its action', async ({ page }) => {
  await page.goto('/iframe.html?id=design-system-toast--with-action&viewMode=story')

  const toast = page.locator('[data-slot="toast"]')
  await expect(toast).toContainText('Design file moved to Trash.')
  await expect(toast.getByRole('button', { name: 'Undo' })).toBeVisible()
})
