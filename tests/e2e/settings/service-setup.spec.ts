import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

// A fresh install: nothing set up yet, and the welcome offered on launch.
test.use({ storageState: { cookies: [], origins: [] } })

test('the welcome lists what is left to set up, one row per group', async ({ page }) => {
  await page.goto('/')
  await new CanvasHelper(page).waitForInit()
  const setup = page.getByTestId('ai-setup-dialog')
  const summary = setup.getByTestId('service-setup-summary')
  await expect(summary.getByRole('heading', { name: /System setup/ })).toBeVisible()
  // Collapsed to its count until opened.
  const toggle = summary.getByRole('button', { name: /System setup/ })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(summary.locator('[data-service-group]')).toHaveCount(0)
  await toggle.click()
  await expect(summary).toContainText('OpenPencil works without these services.')

  const ai = summary.locator('[data-service-group="ai"]')
  await expect(ai).toHaveAttribute('data-state', 'none')
  await expect(ai).toContainText('Not set up')
  const storage = summary.locator('[data-service-group="storage"]')
  await expect(storage).toHaveAttribute('data-state', 'files-only')
  await expect(storage).toContainText('Files only')
  // Groups with nothing left to do stay off the welcome.
  await expect(summary.locator('[data-service-group="browser"]')).toHaveCount(0)

  // A row opens the section that sets its services up.
  await storage.getByRole('button').click()
  await expect(setup).toHaveCount(0)
  await expect(page.getByTestId('settings-storage-panel')).toBeVisible()
})

test('See all services opens the full checklist in Settings', async ({ page }) => {
  await page.goto('/')
  await new CanvasHelper(page).waitForInit()
  const setup = page.getByTestId('ai-setup-dialog')
  await setup.getByRole('button', { name: /System setup/ }).click()
  await setup.getByRole('button', { name: /See all services/ }).click()
  await expect(setup).toHaveCount(0)
  const panel = page.getByTestId('settings-service-setup-panel')
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('settings-section-setup')).toHaveAttribute('aria-selected', 'true')

  const design = panel.locator('[data-service="design-model"]')
  await expect(design).toHaveAttribute('data-status', 'todo')
  await expect(design).toContainText('Not configured')
  await expect(panel.locator('[data-service="cloud-storage"]')).toHaveAttribute(
    'data-status',
    'local-only'
  )
  // Review and Fast tasks are assignable but unused, so they are not on the list.
  await expect(panel.locator('[data-service="review-model"]')).toHaveCount(0)
})
