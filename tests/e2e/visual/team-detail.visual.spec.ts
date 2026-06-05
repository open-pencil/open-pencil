import { expect, test } from '@playwright/test'

import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { cleanState, seedTeam } from '#tests/helpers/api-seed'
import { expectPageScreenshot } from '#tests/helpers/visual'

test.describe('team detail visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('owner-only member state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'team-detail-owner@inkly.test',
      name: 'Team Detail Owner'
    })
    const team = await seedTeam(page, {
      name: 'Product Design',
      boards: ['Launch Board']
    })

    await page.goto(`/team/${team.team.id}`)
    await expect(page.getByTestId('team-detail-view')).toBeVisible()
    await expectPageScreenshot(page, 'team-detail-owner-only.png')
  })

  test('three-member state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'team-detail-members@inkly.test',
      name: 'Team Detail Members'
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
    await expectPageScreenshot(page, 'team-detail-three-members.png')
  })

  test('invite modal state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'team-detail-invite@inkly.test',
      name: 'Team Detail Invite'
    })
    const team = await seedTeam(page, {
      name: 'Growth Team',
      boards: ['Growth Board']
    })

    await page.goto(`/team/${team.team.id}`)
    await page.getByTestId('team-detail-invite-button').click()
    await expect(page.getByTestId('team-invite-submit')).toBeVisible()
    await expectPageScreenshot(page, 'team-detail-invite-modal.png')
  })
})
