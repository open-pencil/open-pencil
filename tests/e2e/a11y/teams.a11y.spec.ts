import { expect, test } from '@playwright/test'

import { runA11yScan, expectNoCriticalViolations } from '#tests/helpers/a11y'
import { cleanState, seedTeam } from '#tests/helpers/api-seed'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { waitForVisualReady } from '#tests/helpers/visual'

const teamsDisabledRules = [
  // TODO(cardene): `color-contrast` in teams views and dialogs is tracked for a follow-up a11y fix PR.
  'color-contrast'
]

test.describe('teams accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('empty state has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'teams-a11y-empty@inkly.test',
      name: 'Teams A11y Empty'
    })

    await page.goto('/teams')
    await expect(page.getByTestId('teams-view')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: teamsDisabledRules
    })
    expectNoCriticalViolations(results)
  })

  test('populated state has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'teams-a11y-populated@inkly.test',
      name: 'Teams A11y Populated'
    })
    await seedTeam(page, { name: 'Design Systems', boards: ['System Board'] })
    await seedTeam(page, { name: 'Growth Experiments', boards: ['Growth Board'] })

    await page.goto('/teams')
    await expect(page.getByTestId('team-card')).toHaveCount(2)
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: teamsDisabledRules
    })
    expectNoCriticalViolations(results)
  })

  test('create modal has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'teams-a11y-modal@inkly.test',
      name: 'Teams A11y Modal'
    })

    await page.goto('/teams')
    await page.getByTestId('team-create-button').click()
    await expect(page.getByTestId('team-create-submit')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: teamsDisabledRules
    })
    expectNoCriticalViolations(results)
  })
})
