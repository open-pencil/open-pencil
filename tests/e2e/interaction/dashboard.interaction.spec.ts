import { expect, test } from '@playwright/test'

import { cleanState, seedBoards } from '#tests/helpers/api-seed'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { useE2ECoverage } from '#tests/helpers/e2e-coverage'
import { clickAndWaitForResponse, expectModal } from '#tests/helpers/interaction'

test.describe('dashboard interaction', () => {
  useE2ECoverage(test, 'dashboard-interaction')

  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('login banner is visible for anonymous users and links to Google login', async ({
    page
  }) => {
    await page.goto('/boards')
    const banner = page.getByTestId('login-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText(/log in|google/i)
  })

  test('logged in users can create a board via the create form', async ({ page }) => {
    test.setTimeout(45_000)
    await mockGoogleLogin(page, { email: 'creator@jfet.co.jp', name: 'Board Creator' })
    await page.goto('/boards')

    await expect(page.getByTestId('board-card')).toHaveCount(0)
    await page.getByTestId('board-create-input').fill('Interaction test board')

    const payload = await clickAndWaitForResponse<{ id: string; name: string }>(
      page,
      page.getByTestId('board-create-button'),
      /\/api\/boards/,
      { method: 'POST' }
    )
    expect(payload.name).toBe('Interaction test board')
  })

  test('search input filters board cards in place', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'searcher@jfet.co.jp', name: 'Searcher' })
    await seedBoards(page, 3)

    await page.goto('/boards')
    await expect(page.getByTestId('board-card')).toHaveCount(3)

    await page.getByTestId('board-search-input').fill('Board 2')
    await expect(page.getByTestId('board-card')).toHaveCount(1)

    await page.getByTestId('board-search-input').fill('NoMatch')
    await expect(page.getByTestId('board-card')).toHaveCount(0)
    await expect(page.getByTestId('board-search-empty')).toBeVisible()

    await page.getByTestId('board-search-input').fill('')
    await expect(page.getByTestId('board-card')).toHaveCount(3)
  })

  test('pinning a board moves it to the top of the list', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'pinner@jfet.co.jp', name: 'Pinner' })
    await seedBoards(page, 3)
    await page.goto('/boards')

    const cards = page.getByTestId('board-card')
    await expect(cards).toHaveCount(3)

    const lastCard = cards.last()
    const lastName = await lastCard.locator('h2').textContent()
    await lastCard.getByTestId('board-pin').click()

    const updatedFirst = cards.first()
    await expect(updatedFirst.locator('h2')).toHaveText(lastName ?? '')
    await expect(updatedFirst.getByTestId('board-pin')).toHaveAttribute('aria-pressed', 'true')

    // Toggle off restores original order (updatedAt-based)
    await updatedFirst.getByTestId('board-pin').click()
    await expect(cards.first().getByTestId('board-pin')).toHaveAttribute('aria-pressed', 'false')
  })

  test('delete confirmation cancels and confirms correctly', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'deleter@jfet.co.jp', name: 'Deleter' })
    await seedBoards(page, 2)
    await page.goto('/boards')

    const firstCard = page.getByTestId('board-card').first()
    await firstCard.hover()

    // open dialog → cancel
    await firstCard.getByTestId('board-delete').click()
    await expectModal(page, 'board-delete-dialog', { open: true })
    await page.getByTestId('board-delete-cancel').click()
    await expectModal(page, 'board-delete-dialog', { open: false })
    await expect(page.getByTestId('board-card')).toHaveCount(2)

    // open dialog → confirm → board removed
    await firstCard.getByTestId('board-delete').click()
    await expectModal(page, 'board-delete-dialog', { open: true })
    await page.getByTestId('board-delete-confirm').click()
    await expect(page.getByTestId('board-card')).toHaveCount(1)
  })
})
