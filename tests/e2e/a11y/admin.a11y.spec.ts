import { expect, test } from '@playwright/test'

import { runA11yScan, expectNoCriticalViolations } from '#tests/helpers/a11y'
import { cleanState, seedBoards } from '#tests/helpers/api-seed'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { waitForVisualReady } from '#tests/helpers/visual'

const adminDisabledRules = [
  // TODO(cardene): contrast on accent buttons / destructive buttons follow-up
  'color-contrast'
]

test.describe('admin view accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('overview tab has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'admin-a11y-overview@jfet.co.jp',
      name: 'Admin A11y Overview'
    })
    await page.goto('/admin')
    await expect(page.getByTestId('admin-overview')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: adminDisabledRules
    })
    expectNoCriticalViolations(results)
  })

  test('boards tab has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'admin-a11y-boards@jfet.co.jp',
      name: 'Admin A11y Boards'
    })
    await seedBoards(page, 3)

    await page.goto('/admin')
    await page.getByTestId('admin-tab-boards').click()
    await expect(page.getByTestId('admin-boards-table-wrap')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: adminDisabledRules
    })
    expectNoCriticalViolations(results)
  })

  test('teams tab empty state has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'admin-a11y-teams@jfet.co.jp',
      name: 'Admin A11y Teams'
    })

    await page.goto('/admin')
    await page.getByTestId('admin-tab-teams').click()
    await expect(page.getByTestId('admin-teams-empty')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: adminDisabledRules
    })
    expectNoCriticalViolations(results)
  })

  test('members tab empty state has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'admin-a11y-members@jfet.co.jp',
      name: 'Admin A11y Members'
    })

    await page.goto('/admin')
    await page.getByTestId('admin-tab-members').click()
    await expect(page.getByTestId('admin-members-empty')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: adminDisabledRules
    })
    expectNoCriticalViolations(results)
  })

  test('activity tab empty state has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'admin-a11y-activity@jfet.co.jp',
      name: 'Admin A11y Activity'
    })

    await page.goto('/admin')
    await page.getByTestId('admin-tab-activity').click()
    await expect(page.getByTestId('admin-activity-empty')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: adminDisabledRules
    })
    expectNoCriticalViolations(results)
  })
})
