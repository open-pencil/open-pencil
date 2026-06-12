import { expect, test } from '@playwright/test'

import { cleanState, seedTeam } from '#tests/helpers/api-seed'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { expectModal } from '#tests/helpers/interaction'

test.describe('team detail interaction', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('owner-only team renders single member with invite + settings entry', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'owner@jfet.co.jp', name: 'Owner Solo' })
    const { team } = await seedTeam(page, { name: 'Solo Team' })

    await page.goto(`/team/${team.id}`)
    await expect(page.getByTestId('team-detail-view')).toBeVisible()
    await expect(page.getByTestId('team-detail-invite-button')).toBeVisible()
    await expect(page.getByTestId('team-detail-settings-link')).toBeVisible()
    await expect(page.getByTestId('team-detail-member-list').locator('li')).toHaveCount(1)
  })

  test('multi member team renders all members', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'owner@jfet.co.jp', name: 'Multi Owner' })
    const { team } = await seedTeam(page, {
      name: 'Multi Team',
      members: [
        { email: 'a@jfet.co.jp', name: 'Alice' },
        { email: 'b@jfet.co.jp', name: 'Bob' }
      ]
    })

    await page.goto(`/team/${team.id}`)
    await expect(page.getByTestId('team-detail-member-list').locator('li')).toHaveCount(3)
  })

  test('invite modal opens via button click', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'owner@jfet.co.jp', name: 'Invite Owner' })
    const { team } = await seedTeam(page, { name: 'Invite Team' })

    await page.goto(`/team/${team.id}`)
    await page.getByTestId('team-detail-invite-button').click()
    await expectModal(page, 'team-invite-dialog', { open: true })
    await expect(page.getByTestId('team-invite-submit')).toBeVisible()
  })
})
