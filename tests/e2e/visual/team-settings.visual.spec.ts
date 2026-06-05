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
      email: 'team-settings-standard@inkly.test',
      name: 'Team Settings Standard'
    })
    const team = await seedTeam(page, {
      name: 'Visual Settings',
      members: [
        { email: 'settings-editor@inkly.test', name: 'Settings Editor', role: 'editor' },
        { email: 'settings-viewer@inkly.test', name: 'Settings Viewer', role: 'viewer' }
      ],
      boards: ['Settings Board']
    })

    await page.goto(`/team/${team.team.id}/settings`)
    await expect(page.getByTestId('team-settings-view')).toBeVisible()
    await expectPageScreenshot(page, 'team-settings-standard.png')
  })

  test('role change modal state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'team-settings-role@inkly.test',
      name: 'Team Settings Role'
    })
    const team = await seedTeam(page, {
      name: 'Role Control',
      members: [
        { email: 'role-target@inkly.test', name: 'Role Target', role: 'editor' },
        { email: 'role-viewer@inkly.test', name: 'Role Viewer', role: 'viewer' }
      ],
      boards: ['Role Board']
    })

    await page.goto(`/team/${team.team.id}/settings`)
    await page
      .locator('li')
      .filter({ hasText: 'role-target@inkly.test' })
      .locator('select')
      .selectOption('viewer')
    await expect(page.getByTestId('team-settings-role-dialog')).toBeVisible()
    await expectPageScreenshot(page, 'team-settings-role-modal.png')
  })

  test('delete confirmation state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'team-settings-delete@inkly.test',
      name: 'Team Settings Delete'
    })
    const team = await seedTeam(page, {
      name: 'Danger Zone',
      members: [{ email: 'danger-member@inkly.test', name: 'Danger Member', role: 'editor' }],
      boards: ['Danger Board']
    })

    await page.goto(`/team/${team.team.id}/settings`)
    await page.getByTestId('team-settings-delete').click()
    await expect(page.getByTestId('team-settings-delete-dialog')).toBeVisible()
    await expectPageScreenshot(page, 'team-settings-delete-confirmation.png')
  })
})
