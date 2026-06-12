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
      email: 'admin-visual-overview@jfet.co.jp',
      name: 'Admin Visual Overview'
    })
    await page.goto('/admin')
    await expect(page.getByTestId('admin-overview')).toBeVisible()
    await expectPageScreenshot(page, 'admin-overview.png')
  })

  test('boards tab with seeded data', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'admin-visual-boards@jfet.co.jp',
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
      email: 'admin-visual-teams@jfet.co.jp',
      name: 'Admin Visual Teams'
    })

    await page.goto('/admin')
    await page.getByTestId('admin-tab-teams').click()
    await expect(page.getByTestId('admin-teams-empty')).toBeVisible()
    await expectPageScreenshot(page, 'admin-teams-empty.png')
  })

  test('members tab empty state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'admin-visual-members@jfet.co.jp',
      name: 'Admin Visual Members'
    })

    await page.goto('/admin')
    await page.getByTestId('admin-tab-members').click()
    await expect(page.getByTestId('admin-members-empty')).toBeVisible()
    await expectPageScreenshot(page, 'admin-members-empty.png')
  })

  test('activity tab empty state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'admin-visual-activity@jfet.co.jp',
      name: 'Admin Visual Activity'
    })

    await page.goto('/admin')
    await page.getByTestId('admin-tab-activity').click()
    await expect(page.getByTestId('admin-activity-empty')).toBeVisible()
    await expectPageScreenshot(page, 'admin-activity-empty.png')
  })
})
