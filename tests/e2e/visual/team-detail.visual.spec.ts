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
      email: 'team-detail-owner@jfet.co.jp',
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
      email: 'team-detail-members@jfet.co.jp',
      name: 'Team Detail Members'
    })
    const team = await seedTeam(page, {
      name: 'Research Ops',
      members: [
        { email: 'member-one@jfet.co.jp', name: 'Member One', role: 'editor' },
        { email: 'member-two@jfet.co.jp', name: 'Member Two', role: 'viewer' }
      ],
      boards: ['Sprint Planning']
    })

    await page.goto(`/team/${team.team.id}`)
    await expect(page.getByText('member-one@jfet.co.jp')).toBeVisible()
    await expectPageScreenshot(page, 'team-detail-three-members.png')
  })

  test('invite modal state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'team-detail-invite@jfet.co.jp',
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
