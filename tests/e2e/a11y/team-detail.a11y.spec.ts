import { expect, test } from '@playwright/test'

import { runA11yScan, expectNoCriticalViolations } from '#tests/helpers/a11y'
import { cleanState, seedTeam } from '#tests/helpers/api-seed'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { waitForVisualReady } from '#tests/helpers/visual'

const teamDetailDisabledRules = [
  // TODO(cardene): `color-contrast` in team detail and invite dialog is tracked for a follow-up a11y fix PR.
  'color-contrast'
]

test.describe('team detail accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('owner-only state has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'team-detail-a11y-owner@inkly.test',
      name: 'Team Detail A11y Owner'
    })
    const team = await seedTeam(page, {
      name: 'Product Design',
      boards: ['Launch Board']
    })

    await page.goto(`/team/${team.team.id}`)
    await expect(page.getByTestId('team-detail-view')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: teamDetailDisabledRules
    })
    expectNoCriticalViolations(results)
  })

  test('multi-member state has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'team-detail-a11y-members@inkly.test',
      name: 'Team Detail A11y Members'
    })
    const team = await seedTeam(page, {
      name: 'Research Ops',
      members: [
        { email: 'member-one@inkly.test', name: 'Member One', role: 'editor' },
        { email: 'member-two@inkly.test', name: 'Member Two', role: 'viewer' }
      ],
      boards: ['Sprint Planning']
    })

    await page.goto(`/team/${team.team.id}`)
    await expect(page.getByText('member-one@inkly.test')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: teamDetailDisabledRules
    })
    expectNoCriticalViolations(results)
  })

  test('invite modal has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'team-detail-a11y-invite@inkly.test',
      name: 'Team Detail A11y Invite'
    })
    const team = await seedTeam(page, {
      name: 'Growth Team',
      boards: ['Growth Board']
    })

    await page.goto(`/team/${team.team.id}`)
    await page.getByTestId('team-detail-invite-button').click()
    await expect(page.getByTestId('team-invite-submit')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: teamDetailDisabledRules
    })
    expectNoCriticalViolations(results)
  })
})
