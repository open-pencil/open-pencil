import { expect, test } from '@playwright/test'

import { cleanState, seedBoards } from '#tests/helpers/api-seed'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { useE2ECoverage } from '#tests/helpers/e2e-coverage'

test.describe('admin view interaction', () => {
  useE2ECoverage(test, 'admin-interaction')

  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('renders the admin layout with all five tabs', async ({ page }) => {
    await page.goto('/admin')

    await expect(page.getByTestId('admin-view')).toBeVisible()
    await expect(page.getByTestId('admin-tabs')).toBeVisible()
    await expect(page.getByTestId('admin-tab-overview')).toBeVisible()
    await expect(page.getByTestId('admin-tab-boards')).toBeVisible()
    await expect(page.getByTestId('admin-tab-teams')).toBeVisible()
    await expect(page.getByTestId('admin-tab-activity')).toBeVisible()
    await expect(page.getByTestId('admin-tab-members')).toBeVisible()
  })

  test('default tab shows the overview metrics', async ({ page }) => {
    await page.goto('/admin')

    await expect(page.getByTestId('admin-overview')).toBeVisible()
    await expect(page.getByTestId('admin-stat-total')).toBeVisible()
    await expect(page.getByTestId('admin-stat-personal')).toBeVisible()
    await expect(page.getByTestId('admin-stat-team-boards')).toBeVisible()
    await expect(page.getByTestId('admin-stat-collaborators')).toBeVisible()
  })

  test('switching tabs replaces the active content', async ({ page }) => {
    await page.goto('/admin')

    await page.getByTestId('admin-tab-boards').click()
    await expect(page.getByTestId('admin-boards')).toBeVisible()
    await expect(page.getByTestId('admin-overview')).toHaveCount(0)

    await page.getByTestId('admin-tab-teams').click()
    await expect(page.getByTestId('admin-teams')).toBeVisible()
    await expect(page.getByTestId('admin-boards')).toHaveCount(0)

    await page.getByTestId('admin-tab-overview').click()
    await expect(page.getByTestId('admin-overview')).toBeVisible()
    await expect(page.getByTestId('admin-teams')).toHaveCount(0)
  })

  test('search filters the boards table by name', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'admin-search@inkly.test', name: 'Admin Search' })
    await seedBoards(page, 3)

    await page.goto('/admin')
    await page.getByTestId('admin-tab-boards').click()

    const rows = page.locator('[data-test-id^="admin-board-row-"]')
    await expect(rows).toHaveCount(3)

    await page.getByTestId('admin-boards-search').fill('Board 2')
    await expect(rows).toHaveCount(1)

    await page.getByTestId('admin-boards-search').fill('NoMatch')
    await expect(page.getByTestId('admin-boards-empty')).toBeVisible()
  })

  test('personal/team filter narrows the boards table', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'admin-filter@inkly.test', name: 'Admin Filter' })
    await seedBoards(page, 2)

    await page.goto('/admin')
    await page.getByTestId('admin-tab-boards').click()

    const rows = page.locator('[data-test-id^="admin-board-row-"]')
    await expect(rows).toHaveCount(2)

    await page.getByTestId('admin-boards-filter').selectOption('team')
    // seedBoards creates personal boards only by default
    await expect(page.getByTestId('admin-boards-empty')).toBeVisible()

    await page.getByTestId('admin-boards-filter').selectOption('personal')
    await expect(rows).toHaveCount(2)
  })

  test('teams tab shows empty state when no teams exist', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'admin-teams@inkly.test', name: 'Admin Teams' })

    await page.goto('/admin')
    await page.getByTestId('admin-tab-teams').click()

    await expect(page.getByTestId('admin-teams-empty')).toBeVisible()
  })

  test('dashboard link navigates back to /dashboard', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'admin-nav@inkly.test', name: 'Admin Nav' })
    await page.goto('/admin')

    await page.getByTestId('admin-dashboard-link').click()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('sorting boards by name toggles ascending/descending', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'admin-sort@inkly.test', name: 'Admin Sort' })
    await seedBoards(page, 3)

    await page.goto('/admin')
    await page.getByTestId('admin-tab-boards').click()

    const sortButton = page.getByTestId('admin-boards-sort-name')
    await sortButton.click()
    await expect(sortButton).toContainText('↑')

    await sortButton.click()
    await expect(sortButton).toContainText('↓')
  })

  test('activity tab shows empty state when no notifications exist', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'admin-activity-empty@inkly.test', name: 'Admin Activity Empty' })
    await page.goto('/admin')
    await page.getByTestId('admin-tab-activity').click()
    await expect(page.getByTestId('admin-activity-empty')).toBeVisible()
  })

  test('activity tab renders filter controls and disables export when empty', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'admin-activity-filter@inkly.test', name: 'Admin Activity Filter' })
    await page.goto('/admin')
    await page.getByTestId('admin-tab-activity').click()

    await expect(page.getByTestId('admin-activity-search')).toBeVisible()
    await expect(page.getByTestId('admin-activity-type')).toBeVisible()
    await expect(page.getByTestId('admin-activity-range')).toBeVisible()
    await expect(page.getByTestId('admin-activity-export')).toBeDisabled()
  })

  test('export CSV button is disabled when no boards exist', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'admin-export-empty@inkly.test', name: 'Admin Export Empty' })
    await page.goto('/admin')
    await page.getByTestId('admin-tab-boards').click()
    await expect(page.getByTestId('admin-boards-export')).toBeDisabled()
  })

  test('select all visible boards via header checkbox', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'admin-bulk-select@inkly.test', name: 'Admin Bulk Select' })
    await seedBoards(page, 3)

    await page.goto('/admin')
    await page.getByTestId('admin-tab-boards').click()

    const rows = page.locator('[data-test-id^="admin-board-row-"]')
    await expect(rows).toHaveCount(3)

    await page.getByTestId('admin-boards-select-all').check()
    await expect(page.getByTestId('admin-boards-bulk-delete')).toBeVisible()
    await expect(page.getByTestId('admin-boards-bulk-delete')).toContainText('3')

    await page.getByTestId('admin-boards-clear-selection').click()
    await expect(page.getByTestId('admin-boards-bulk-delete')).toHaveCount(0)
  })

  test('row checkbox toggles a single selection and shows bulk action', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'admin-bulk-row@inkly.test', name: 'Admin Bulk Row' })
    await seedBoards(page, 2)

    await page.goto('/admin')
    await page.getByTestId('admin-tab-boards').click()

    const firstRow = page.locator('[data-test-id^="admin-board-row-"]').first()
    const boardId = await firstRow.getAttribute('data-test-id')
    const id = boardId?.replace('admin-board-row-', '') ?? ''

    await page.getByTestId(`admin-board-select-${id}`).check()
    await expect(page.getByTestId('admin-boards-bulk-delete')).toContainText('1')

    await page.getByTestId(`admin-board-select-${id}`).uncheck()
    await expect(page.getByTestId('admin-boards-bulk-delete')).toHaveCount(0)
  })

  test('bulk move dialog opens with target select and personal option', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'admin-move-open@inkly.test', name: 'Admin Move Open' })
    await seedBoards(page, 2)

    await page.goto('/admin')
    await page.getByTestId('admin-tab-boards').click()
    await page.getByTestId('admin-boards-select-all').check()

    await expect(page.getByTestId('admin-boards-bulk-move')).toBeVisible()
    await page.getByTestId('admin-boards-bulk-move').click()
    await expect(page.getByTestId('admin-bulk-move-dialog')).toBeVisible()
    await expect(page.getByTestId('admin-bulk-move-target')).toBeVisible()
    await expect(page.getByTestId('admin-bulk-move-target').locator('option').first()).toHaveAttribute('value', 'personal')

    await page.getByTestId('admin-bulk-move-cancel').click()
    await expect(page.getByTestId('admin-bulk-move-dialog')).toHaveCount(0)
  })

  test('bulk delete removes all selected boards after confirmation', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'admin-bulk-delete@inkly.test', name: 'Admin Bulk Delete' })
    await seedBoards(page, 2)

    await page.goto('/admin')
    await page.getByTestId('admin-tab-boards').click()

    const rows = page.locator('[data-test-id^="admin-board-row-"]')
    await expect(rows).toHaveCount(2)

    await page.getByTestId('admin-boards-select-all').check()

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByTestId('admin-boards-bulk-delete').click()

    await expect(rows).toHaveCount(0)
    await expect(page.getByTestId('admin-boards-empty')).toBeVisible()
  })

  test('members tab export CSV is disabled when empty', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'admin-members-export-empty@inkly.test', name: 'Admin Members Export Empty' })
    await page.goto('/admin')
    await page.getByTestId('admin-tab-members').click()
    await expect(page.getByTestId('admin-members-export')).toBeDisabled()
  })

  test('members tab shows empty state when user has no teams', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'admin-members-empty@inkly.test', name: 'Admin Members Empty' })
    await page.goto('/admin')
    await page.getByTestId('admin-tab-members').click()
    await expect(page.getByTestId('admin-members-empty')).toBeVisible()
  })

  test('export CSV downloads a CSV file with all visible board rows', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'admin-export@inkly.test', name: 'Admin Export' })
    await seedBoards(page, 2)

    await page.goto('/admin')
    await page.getByTestId('admin-tab-boards').click()
    await expect(page.locator('[data-test-id^="admin-board-row-"]')).toHaveCount(2)

    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('admin-boards-export').click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/^inkly-boards-[a-z]{2}(?:-[A-Z]{2})?-\d+\.csv$/)
  })
})
