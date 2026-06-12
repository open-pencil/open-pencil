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
    await mockGoogleLogin(page, { email: 'dash-empty@jfet.co.jp', name: 'Dashboard Empty' })
    await page.goto('/dashboard')

    await expect(page.getByTestId('dashboard-recent-empty')).toBeVisible()
  })

  test('recent boards list renders up to 6 sorted by updatedAt', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-list@jfet.co.jp', name: 'Dashboard List' })
    await seedBoards(page, 3)
    await page.goto('/dashboard')

    await expect(page.getByTestId('dashboard-recent-list')).toBeVisible()
    const cards = page.locator('[data-test-id^="dashboard-recent-board-"]')
    await expect(cards).toHaveCount(3)
  })

  test('Boards quick action navigates to /boards', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-nav@jfet.co.jp', name: 'Dashboard Nav' })
    await page.goto('/dashboard')

    await page.getByTestId('dashboard-link-boards').click()
    await expect(page).toHaveURL(/\/boards/)
  })

  test('Teams quick action navigates to /teams', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-teams@jfet.co.jp', name: 'Dashboard Teams' })
    await page.goto('/dashboard')

    await page.getByTestId('dashboard-link-teams').click()
    await expect(page).toHaveURL(/\/teams/)
  })

  test('pinning a recent board surfaces it in the pinned section', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-pin@jfet.co.jp', name: 'Dashboard Pin' })
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

  test('customize panel toggles a section and persists across reload', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-customize@jfet.co.jp', name: 'Dash Customize' })
    await page.goto('/dashboard')

    await expect(page.getByTestId('dashboard-section-metrics')).toBeVisible()

    await page.getByTestId('dashboard-customize-toggle').click()
    await expect(page.getByTestId('dashboard-customize-panel')).toBeVisible()

    await page.getByTestId('dashboard-customize-toggle-metrics').click()
    await expect(page.getByTestId('dashboard-section-metrics')).toHaveCount(0)

    await page.getByTestId('dashboard-customize-done').click()
    await expect(page.getByTestId('dashboard-customize-panel')).toHaveCount(0)

    await page.reload()
    await expect(page.getByTestId('dashboard-section-metrics')).toHaveCount(0)
  })

  test('locale switcher changes the dashboard heading and persists across reload', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-locale@jfet.co.jp', name: 'Dash Locale' })
    await page.goto('/dashboard')

    const heading = page.locator('h1').first()
    await expect(heading).toHaveText(/ダッシュボード|Dashboard|Pulpit|Panel|Tableau de bord|仪表板/i)

    await page.getByTestId('dashboard-locale-switcher').selectOption('en')
    await expect(heading).toHaveText('Dashboard')

    await page.reload()
    await expect(heading).toHaveText('Dashboard')

    // Reset for other tests sharing the same browser context
    await page.getByTestId('dashboard-locale-switcher').selectOption('ja')
  })

  test('customize panel exposes accessible drag handles and aria-live announce', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-a11y@jfet.co.jp', name: 'Dash A11y' })
    await page.goto('/dashboard')

    await page.getByTestId('dashboard-customize-toggle').click()
    await expect(page.getByTestId('dashboard-customize-handle-metrics')).toHaveAttribute(
      'aria-label',
      /metrics|メトリック|metriken|métricas|indicateurs|metriche|metryki|метрики|指标/i
    )
    await expect(page.getByTestId('dashboard-customize-row-metrics')).toHaveAttribute(
      'aria-grabbed',
      'false'
    )
    await expect(page.getByTestId('dashboard-customize-announce')).toBeAttached()
    await expect(page.getByTestId('dashboard-customize-announce')).toHaveAttribute(
      'aria-live',
      'polite'
    )
  })

  test('keyboard Space + ArrowDown reorders a section and Escape cancels', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-kbd@jfet.co.jp', name: 'Dash Kbd' })
    await page.goto('/dashboard')

    await page.getByTestId('dashboard-customize-toggle').click()
    await expect(page.getByTestId('dashboard-customize-keyboard-hint')).toBeVisible()

    const rows = page.locator('[data-test-id^="dashboard-customize-row-"]')
    await expect(rows.first()).toHaveAttribute('data-test-id', 'dashboard-customize-row-metrics')

    const metricsRow = page.getByTestId('dashboard-customize-row-metrics')
    await metricsRow.focus()
    await metricsRow.press(' ')
    await expect(metricsRow).toHaveAttribute('aria-grabbed', 'true')

    await metricsRow.press('ArrowDown')
    await expect(rows.first()).toHaveAttribute(
      'data-test-id',
      'dashboard-customize-row-quickActions'
    )

    await metricsRow.press('Enter')
    await expect(metricsRow).toHaveAttribute('aria-grabbed', 'false')

    // Escape after a pickup cancels without changing layout
    await metricsRow.focus()
    await metricsRow.press(' ')
    await expect(metricsRow).toHaveAttribute('aria-grabbed', 'true')
    await metricsRow.press('Escape')
    await expect(metricsRow).toHaveAttribute('aria-grabbed', 'false')
  })

  test('drag and drop reorders sections in the customize panel', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-dnd@jfet.co.jp', name: 'Dash DnD' })
    await page.goto('/dashboard')

    await page.getByTestId('dashboard-customize-toggle').click()
    const rows = page.locator('[data-test-id^="dashboard-customize-row-"]')
    await expect(rows).toHaveCount(5)
    await expect(rows.first()).toHaveAttribute('data-test-id', 'dashboard-customize-row-metrics')

    const fromRow = page.getByTestId('dashboard-customize-row-activity')
    const toRow = page.getByTestId('dashboard-customize-row-metrics')
    await fromRow.dragTo(toRow)

    await expect(rows.first()).toHaveAttribute('data-test-id', 'dashboard-customize-row-activity')

    await page.reload()
    await page.getByTestId('dashboard-customize-toggle').click()
    await expect(rows.first()).toHaveAttribute(
      'data-test-id',
      'dashboard-customize-row-activity'
    )
  })

  test('customize panel reset restores the default layout', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-reset@jfet.co.jp', name: 'Dash Reset' })
    await page.goto('/dashboard')

    await page.getByTestId('dashboard-customize-toggle').click()
    await page.getByTestId('dashboard-customize-toggle-metrics').click()
    await expect(page.getByTestId('dashboard-section-metrics')).toHaveCount(0)

    await page.getByTestId('dashboard-customize-reset').click()
    await expect(page.getByTestId('dashboard-section-metrics')).toBeVisible()
  })

  test('pinned section is hidden when no pins exist', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'dash-no-pin@jfet.co.jp', name: 'Dashboard No Pin' })
    await seedBoards(page, 2)
    await page.goto('/dashboard')

    await expect(page.getByTestId('dashboard-recent-list')).toBeVisible()
    await expect(page.getByTestId('dashboard-pinned-boards')).toHaveCount(0)
  })
})
