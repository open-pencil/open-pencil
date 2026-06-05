import { expect, test } from '@playwright/test'

import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { cleanState, seedBoards } from '#tests/helpers/api-seed'
import { expectPageScreenshot } from '#tests/helpers/visual'

test.describe('dashboard visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('empty state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'dashboard-empty@inkly.test',
      name: 'Dashboard Empty'
    })

    await page.goto('/boards')
    await expect(page.getByTestId('boards-view')).toBeVisible()
    await expectPageScreenshot(page, 'dashboard-empty.png')
  })

  test('populated state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'dashboard-populated@inkly.test',
      name: 'Dashboard Populated'
    })
    await seedBoards(page, 3)

    await page.goto('/boards')
    await expect(page.getByTestId('board-card')).toHaveCount(3)
    await expectPageScreenshot(page, 'dashboard-populated.png')
  })

  test('search input state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'dashboard-search@inkly.test',
      name: 'Dashboard Search'
    })
    await seedBoards(page, 3)

    await page.goto('/boards')
    await page.getByTestId('board-search-input').fill('Board 2')
    await expectPageScreenshot(page, 'dashboard-search.png')
  })

  test('login banner state', async ({ page }) => {
    await page.goto('/boards')
    await expect(page.getByTestId('login-banner')).toBeVisible()
    await expectPageScreenshot(page, 'dashboard-login-banner.png')
  })
})
