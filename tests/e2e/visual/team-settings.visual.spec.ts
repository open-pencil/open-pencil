import { expect, test } from '@playwright/test'

import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { cleanState, seedTeam } from '#tests/helpers/api-seed'
import { expectPageScreenshot } from '#tests/helpers/visual'

test.describe('team settings visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('standard state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'team-settings-standard@jfet.co.jp',
      name: 'Team Settings Standard'
    })
    const team = await seedTeam(page, {
      name: 'Visual Settings',
      members: [
        { email: 'settings-editor@jfet.co.jp', name: 'Settings Editor', role: 'editor' },
        { email: 'settings-viewer@jfet.co.jp', name: 'Settings Viewer', role: 'viewer' }
      ],
      boards: ['Settings Board']
    })

    await page.goto(`/team/${team.team.id}/settings`)
    await expect(page.getByTestId('team-settings-view')).toBeVisible()
    await expectPageScreenshot(page, 'team-settings-standard.png')
  })

  test('role change modal state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'team-settings-role@jfet.co.jp',
      name: 'Team Settings Role'
    })
    const team = await seedTeam(page, {
      name: 'Role Control',
      members: [
        { email: 'role-target@jfet.co.jp', name: 'Role Target', role: 'editor' },
        { email: 'role-viewer@jfet.co.jp', name: 'Role Viewer', role: 'viewer' }
      ],
      boards: ['Role Board']
    })

    await page.goto(`/team/${team.team.id}/settings`)
    await page
      .locator('li')
      .filter({ hasText: 'role-target@jfet.co.jp' })
      .locator('select')
      .selectOption('viewer')
    await expect(page.getByTestId('team-settings-role-dialog')).toBeVisible()
    await expectPageScreenshot(page, 'team-settings-role-modal.png')
  })

  test('delete confirmation state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'team-settings-delete@jfet.co.jp',
      name: 'Team Settings Delete'
    })
    const team = await seedTeam(page, {
      name: 'Danger Zone',
      members: [{ email: 'danger-member@jfet.co.jp', name: 'Danger Member', role: 'editor' }],
      boards: ['Danger Board']
    })

    await page.goto(`/team/${team.team.id}/settings`)
    await page.getByTestId('team-settings-delete').click()
    await expect(page.getByTestId('team-settings-delete-dialog')).toBeVisible()
    await expectPageScreenshot(page, 'team-settings-delete-confirmation.png')
  })
})
