import { expect, test } from '@playwright/test'

import { cleanState, seedTeam } from '#tests/helpers/api-seed'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { expectModal } from '#tests/helpers/interaction'

test.describe('team settings interaction', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('settings view renders save + delete entry points', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'owner@jfet.co.jp', name: 'Settings Owner' })
    const { team } = await seedTeam(page, { name: 'Settings Team' })

    await page.goto(`/team/${team.id}/settings`)
    await expect(page.getByTestId('team-settings-view')).toBeVisible()
    await expect(page.getByTestId('team-settings-save')).toBeVisible()
    await expect(page.getByTestId('team-settings-delete')).toBeVisible()
  })

  test('delete dialog opens via delete button', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'owner@jfet.co.jp', name: 'Delete Owner' })
    const { team } = await seedTeam(page, { name: 'Delete Team' })

    await page.goto(`/team/${team.id}/settings`)
    await page.getByTestId('team-settings-delete').click()
    await expectModal(page, 'team-settings-delete-dialog', { open: true })
    await expect(page.getByTestId('team-settings-delete-confirm')).toBeVisible()
  })

  test('member role controls are rendered for each member', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'owner@jfet.co.jp', name: 'Role Owner' })
    const { team } = await seedTeam(page, {
      name: 'Role Team',
      members: [{ email: 'member@jfet.co.jp', name: 'Member' }]
    })

    await page.goto(`/team/${team.id}/settings`)
    // role-select / remove は owner / member の 2 件分 render (owner は disabled)
    await expect(page.getByTestId('team-settings-role-select')).toHaveCount(2)
    await expect(page.getByTestId('team-settings-remove-member')).toHaveCount(2)
    // non-owner member の remove は enabled
    const memberRemove = page.getByTestId('team-settings-remove-member').nth(1)
    await expect(memberRemove).toBeEnabled()
  })
})
