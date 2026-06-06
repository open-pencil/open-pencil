import { expect, test } from '@playwright/test'

import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { cleanState, seedBoards } from '#tests/helpers/api-seed'
import { expectPageScreenshot } from '#tests/helpers/visual'

test.describe('admin view visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('overview tab', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'admin-visual-overview@inkly.test',
      name: 'Admin Visual Overview'
    })
    await page.goto('/admin')
    await expect(page.getByTestId('admin-overview')).toBeVisible()
    await expectPageScreenshot(page, 'admin-overview.png')
  })

  test('boards tab with seeded data', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'admin-visual-boards@inkly.test',
      name: 'Admin Visual Boards'
    })
    await seedBoards(page, 3)

    await page.goto('/admin')
    await page.getByTestId('admin-tab-boards').click()
    await expect(page.getByTestId('admin-boards-table-wrap')).toBeVisible()
    await expectPageScreenshot(page, 'admin-boards.png')
  })

  test('teams tab empty state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'admin-visual-teams@inkly.test',
      name: 'Admin Visual Teams'
    })

    await page.goto('/admin')
    await page.getByTestId('admin-tab-teams').click()
    await expect(page.getByTestId('admin-teams-empty')).toBeVisible()
    await expectPageScreenshot(page, 'admin-teams-empty.png')
  })
})
