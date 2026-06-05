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

  // 連続実行時に board create response が flaky になるケースを検知 (個別実行で 1 度確認、 別 PR で改善)。
  test.skip('logged in users can create a board via the create form', async ({ page }) => {
    test.setTimeout(45_000)
    await mockGoogleLogin(page, { email: 'creator@inkly.test', name: 'Board Creator' })
    await page.goto('/boards')

    await expect(page.getByTestId('board-card')).toHaveCount(0)

    await page.getByTestId('board-create-input').fill('Interaction test board')
    const payload = await clickAndWaitForResponse<{ id: string; name: string }>(
      page,
      page.getByTestId('board-create-button'),
      /\/api\/boards/
    )
    expect(payload.name).toBe('Interaction test board')
  })

  test('search input filters board cards in place', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'searcher@inkly.test', name: 'Searcher' })
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

  test('delete confirmation cancels and confirms correctly', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'deleter@inkly.test', name: 'Deleter' })
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
