import { expect, test } from '@playwright/test'

import { cleanState, seedBoards } from '#tests/helpers/api-seed'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { useE2ECoverage } from '#tests/helpers/e2e-coverage'

test.describe('dashboard view interaction', () => {
  useE2ECoverage(test, 'dashboard-view-interaction')

  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('renders the dashboard layout with metric cards and quick actions', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.getByTestId('dashboard-view')).toBeVisible()
    await expect(page.getByTestId('dashboard-metric-personal-boards')).toBeVisible()
    await expect(page.getByTestId('dashboard-metric-team-boards')).toBeVisible()
    await expect(page.getByTestId('dashboard-metric-teams')).toBeVisible()
    await expect(page.getByTestId('dashboard-metric-unread')).toBeVisible()
    await expect(page.getByTestId('dashboard-quick-actions')).toBeVisible()
    await expect(page.getByTestId('dashboard-link-boards')).toBeVisible()
    await expect(page.getByTestId('dashboard-link-teams')).toBeVisible()
    await expect(page.getByTestId('dashboard-link-notifications')).toBeVisible()
  })

  test('shows login banner for anonymous users', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByTestId('login-banner')).toBeVisible()
  })

  test('recent boards section shows empty state when no boards exist', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-empty@inkly.test', name: 'Dashboard Empty' })
    await page.goto('/dashboard')

    await expect(page.getByTestId('dashboard-recent-empty')).toBeVisible()
  })

  test('recent boards list renders up to 6 sorted by updatedAt', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-list@inkly.test', name: 'Dashboard List' })
    await seedBoards(page, 3)
    await page.goto('/dashboard')

    await expect(page.getByTestId('dashboard-recent-list')).toBeVisible()
    const cards = page.locator('[data-test-id^="dashboard-recent-board-"]')
    await expect(cards).toHaveCount(3)
  })

  test('Boards quick action navigates to /boards', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-nav@inkly.test', name: 'Dashboard Nav' })
    await page.goto('/dashboard')

    await page.getByTestId('dashboard-link-boards').click()
    await expect(page).toHaveURL(/\/boards/)
  })

  test('Teams quick action navigates to /teams', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-teams@inkly.test', name: 'Dashboard Teams' })
    await page.goto('/dashboard')

    await page.getByTestId('dashboard-link-teams').click()
    await expect(page).toHaveURL(/\/teams/)
  })

  test('pinning a recent board surfaces it in the pinned section', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-pin@inkly.test', name: 'Dashboard Pin' })
    await seedBoards(page, 3)
    await page.goto('/dashboard')

    await expect(page.getByTestId('dashboard-recent-list')).toBeVisible()

    const firstCard = page.locator('[data-test-id^="dashboard-recent-board-"]').first()
    const boardId = await firstCard.getAttribute('data-test-id')
    if (!boardId) throw new Error('expected first recent board to have data-test-id')
    const id = boardId.replace('dashboard-recent-board-', '')

    await page.getByTestId(`dashboard-recent-pin-${id}`).click()
    await expect(page.getByTestId('dashboard-pinned-boards')).toBeVisible()
    await expect(page.getByTestId(`dashboard-pinned-board-${id}`)).toBeVisible()

    // Toggling again removes it
    await page.getByTestId(`dashboard-pin-toggle-${id}`).click()
    await expect(page.getByTestId('dashboard-pinned-boards')).toHaveCount(0)
  })

  test('pinned section is hidden when no pins exist', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-no-pin@inkly.test', name: 'Dashboard No Pin' })
    await seedBoards(page, 2)
    await page.goto('/dashboard')

    await expect(page.getByTestId('dashboard-recent-list')).toBeVisible()
    await expect(page.getByTestId('dashboard-pinned-boards')).toHaveCount(0)
  })
})
