import { expect, test } from '@playwright/test'

import { cleanState, seedTeam } from '#tests/helpers/api-seed'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { expectModal } from '#tests/helpers/interaction'

test.describe('teams interaction', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('empty state displays the create entry point', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'empty@jfet.co.jp', name: 'Empty Teams' })
    await page.goto('/teams')

    await expect(page.getByTestId('teams-view')).toBeVisible()
    await expect(page.getByTestId('team-create-button')).toBeVisible()
    await expect(page.getByTestId('team-card')).toHaveCount(0)
  })

  test('populated state renders all owned teams', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'populated@jfet.co.jp', name: 'Populated Teams' })
    await seedTeam(page, { name: 'Design Systems' })
    await seedTeam(page, { name: 'Growth Experiments' })

    await page.goto('/teams')
    await expect(page.getByTestId('team-card')).toHaveCount(2)
  })

  test('create modal opens and closes via submit', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'creator@jfet.co.jp', name: 'Team Creator' })
    await page.goto('/teams')

    await page.getByTestId('team-create-button').click()
    await expectModal(page, 'team-create-dialog', { open: true })

    const submit = page.getByTestId('team-create-submit')
    await expect(submit).toBeVisible()
  })
})
