import { expect, test } from '@playwright/test'

import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { cleanState, seedTeam } from '#tests/helpers/api-seed'
import { expectPageScreenshot } from '#tests/helpers/visual'

test.describe('teams visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('empty state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'teams-empty@jfet.co.jp',
      name: 'Teams Empty'
    })

    await page.goto('/teams')
    await expect(page.getByTestId('teams-view')).toBeVisible()
    await expectPageScreenshot(page, 'teams-empty.png')
  })

  test('populated state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'teams-populated@jfet.co.jp',
      name: 'Teams Populated'
    })
    await seedTeam(page, { name: 'Design Systems', boards: ['System Board'] })
    await seedTeam(page, { name: 'Growth Experiments', boards: ['Growth Board'] })

    await page.goto('/teams')
    await expect(page.getByTestId('team-card')).toHaveCount(2)
    await expectPageScreenshot(page, 'teams-populated.png')
  })

  test('create modal state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'teams-modal@jfet.co.jp',
      name: 'Teams Modal'
    })

    await page.goto('/teams')
    await page.getByTestId('team-create-button').click()
    await expect(page.getByTestId('team-create-submit')).toBeVisible()
    await expectPageScreenshot(page, 'teams-create-modal.png')
  })
})
