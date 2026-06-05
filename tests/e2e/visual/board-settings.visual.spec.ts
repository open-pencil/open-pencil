import { expect, test, type Page } from '@playwright/test'

import { cleanState, seedBoards } from '#tests/helpers/api-seed'
import { expectPageScreenshot } from '#tests/helpers/visual'

async function seedInvitations(page: Page, boardId: string, emails: string[]) {
  const response = await page.request.post('/api/test/seed/invitations', {
    data: {
      boardId,
      items: emails.map((email) => ({
        email,
        role: 'editor'
      }))
    }
  })

  if (!response.ok()) {
    throw new Error(`Failed to seed invitations: ${response.status()} ${response.statusText()}`)
  }
}

test.describe('board settings visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('invitation empty state', async ({ page }) => {
    const [board] = await seedBoards(page, 1)

    await page.goto(`/board/${board.id}/settings`)
    await expect(page.getByTestId('board-invitation-list')).toBeVisible()
    await expectPageScreenshot(page, 'board-settings-empty.png')
  })

  test('invitation populated state', async ({ page }) => {
    const [board] = await seedBoards(page, 1)

    await seedInvitations(page, board.id, ['first-invitee@inkly.test', 'second-invitee@inkly.test'])
    await page.goto(`/board/${board.id}/settings`)
    await expect(page.getByTestId('board-revoke-invitation')).toHaveCount(2)
    await expectPageScreenshot(page, 'board-settings-populated.png')
  })

  test('revoke confirmation state', async ({ page }) => {
    const [board] = await seedBoards(page, 1)

    await seedInvitations(page, board.id, ['revoke-first@inkly.test', 'revoke-second@inkly.test'])
    await page.goto(`/board/${board.id}/settings`)
    await page.getByTestId('board-revoke-invitation').first().click()
    await expect(page.getByTestId('board-revoke-dialog')).toBeVisible()
    await expectPageScreenshot(page, 'board-settings-revoke-confirmation.png')
  })
})
