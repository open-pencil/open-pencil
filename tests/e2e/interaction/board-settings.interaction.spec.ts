import { expect, test } from '@playwright/test'

import { cleanState, seedBoards } from '#tests/helpers/api-seed'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'

test.describe('board settings interaction', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('settings view renders with share entry point', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'owner@jfet.co.jp', name: 'Owner' })
    const seeded = await seedBoards(page, 1)
    const board = seeded[0]

    await page.goto(`/board/${board.id}/settings`)
    await expect(page.getByTestId('board-settings-view')).toBeVisible()
    await expect(page.getByTestId('board-settings-share-button')).toBeVisible()
  })

  test('invitation empty state shows no list items', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'empty@jfet.co.jp', name: 'Empty Owner' })
    const seeded = await seedBoards(page, 1)
    const board = seeded[0]

    await page.goto(`/board/${board.id}/settings`)
    await expect(page.getByTestId('board-invitation-list').locator('li')).toHaveCount(0)
  })
})
