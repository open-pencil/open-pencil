import { expect, test } from '@playwright/test'

import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { cleanState, seedBoards } from '#tests/helpers/api-seed'
import { expectPageScreenshot } from '#tests/helpers/visual'

test.describe('dashboard view visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('anonymous state', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByTestId('dashboard-view')).toBeVisible()
    await expectPageScreenshot(page, 'dashboard-view-anonymous.png')
  })

  test('empty state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'dashboard-view-empty@inkly.test',
      name: 'Dashboard View Empty'
    })

    await page.goto('/dashboard')
    await expect(page.getByTestId('dashboard-recent-empty')).toBeVisible()
    await expectPageScreenshot(page, 'dashboard-view-empty.png')
  })

  test('populated state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'dashboard-view-populated@inkly.test',
      name: 'Dashboard View Populated'
    })
    await seedBoards(page, 3)

    await page.goto('/dashboard')
    await expect(page.getByTestId('dashboard-recent-list')).toBeVisible()
    await expectPageScreenshot(page, 'dashboard-view-populated.png')
  })
})
