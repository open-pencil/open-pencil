import { expect, test } from '@playwright/test'

import { mockGoogleLogin } from '../../helpers/e2e-auth'

test('signed-in users receive invitation and team invite notifications', async ({
  browser,
  page
}) => {
  const boardName = `Notify Board ${Date.now()}`
  const teamName = `Notify Team ${Date.now()}`
  const inviteeEmail = `notify-${Date.now()}@jfet.co.jp`

  const inviteeContext = await browser.newContext()
  const inviteePage = await inviteeContext.newPage()
  await mockGoogleLogin(inviteePage, {
    email: inviteeEmail,
    name: 'Notification Invitee'
  })

  await mockGoogleLogin(page, {
    email: 'notification-owner@jfet.co.jp',
    name: 'Notification Owner'
  })

  await page.goto('/boards')
  await expect(page.getByTestId('boards-view')).toBeVisible()
  await page.getByTestId('board-create-input').fill(boardName)
  await page.getByTestId('board-create-button').click()

  await expect(page.getByTestId('editor-root')).toBeVisible()
  await page.getByTestId('invite-share-button').click()
  await expect(page.getByTestId('share-modal')).toBeVisible()
  await page.getByTestId('share-email-input').fill(inviteeEmail)
  await page.getByTestId('share-submit').click()

  await page.goto('/teams')
  await expect(page.getByTestId('teams-view')).toBeVisible()
  await page.getByTestId('team-create-button').click()
  await page.getByTestId('team-create-input').fill(teamName)
  await page.getByTestId('team-create-submit').click()

  await expect(page.getByTestId('team-detail-view')).toBeVisible()
  await page.getByTestId('team-detail-invite-button').click()
  await page.getByTestId('team-invite-email-input').fill(inviteeEmail)
  await page.getByTestId('team-invite-submit').click()
  await expect(page.getByText(inviteeEmail)).toBeVisible()

  await inviteePage.goto('/boards')
  await expect(inviteePage.getByTestId('boards-view')).toBeVisible()
  await expect(inviteePage.getByTestId('notification-bell-badge')).toHaveText('2')

  await inviteePage.getByTestId('notification-bell-trigger').click()
  await expect(inviteePage.getByTestId('notification-bell-popover')).toBeVisible()
  await expect(inviteePage.getByText(boardName)).toBeVisible()
  await expect(inviteePage.getByText(teamName)).toBeVisible()

  await inviteePage.goto('/notifications')
  await expect(inviteePage.getByTestId('notifications-view')).toBeVisible()
  await expect(inviteePage.getByTestId('notification-item')).toHaveCount(2)
  await expect(inviteePage.getByText(boardName)).toBeVisible()
  await expect(inviteePage.getByText(teamName)).toBeVisible()

  await inviteeContext.close()
})
