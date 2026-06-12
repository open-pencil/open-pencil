import { expect, test } from '@playwright/test'

import { cleanState, seedNotifications } from '#tests/helpers/api-seed'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'

function invitationItem(read: boolean, boardName = 'Board A') {
  const id = `inv-${Math.random().toString(36).slice(2, 8)}`
  return {
    type: 'invitation' as const,
    read,
    payload: {
      invitationId: id,
      boardId: `board-${id}`,
      boardName,
      role: 'editor' as const,
      inviterDisplayName: 'Owner User',
      inviteeEmail: 'reader@jfet.co.jp',
      url: `/invite/${id}`
    }
  }
}

function teamInviteItem(read: boolean, teamName = 'Team X') {
  const id = `team-${Math.random().toString(36).slice(2, 8)}`
  return {
    type: 'team_invite' as const,
    read,
    payload: {
      teamId: id,
      teamName,
      role: 'editor' as const,
      inviterDisplayName: 'Team Owner',
      inviteeEmail: 'reader@jfet.co.jp',
      url: `/team/${id}`
    }
  }
}

function mentionItem(read: boolean, boardName = 'Mention Board') {
  const id = `board-${Math.random().toString(36).slice(2, 8)}`
  return {
    type: 'mention' as const,
    read,
    payload: {
      boardId: id,
      boardName,
      mentionedByDisplayName: 'Mentioner',
      message: 'Hey @user, check this out!',
      url: `/?board=${id}&name=${encodeURIComponent(boardName)}`
    }
  }
}

test.describe('notifications interaction', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('empty state shows the empty placeholder and zero badge', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'empty@jfet.co.jp', name: 'Empty User' })
    await page.goto('/notifications')

    await expect(page.getByTestId('notifications-view')).toBeVisible()
    await expect(page.getByTestId('notifications-empty')).toBeVisible()
    await expect(page.getByTestId('notification-bell-badge')).toHaveCount(0)
  })

  test('unread notifications populate the list', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'populated@jfet.co.jp', name: 'Populated User' })
    await seedNotifications(page, {
      items: [invitationItem(false), teamInviteItem(false), mentionItem(true)]
    })

    await page.goto('/notifications')
    await expect(page.getByTestId('notification-item')).toHaveCount(3)
  })

  test('mark-read flips one item to read state', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'reader@jfet.co.jp', name: 'Reader' })
    await seedNotifications(page, {
      items: [invitationItem(false, 'Mark Me'), mentionItem(false, 'Other')]
    })

    await page.goto('/notifications')
    await expect(page.getByTestId('notification-mark-read')).toHaveCount(2)

    await page.getByTestId('notification-item').first().getByTestId('notification-mark-read').click()
    // mark-read 後 unread → read で残り mark-read button は 1 件のみ
    await expect(page.getByTestId('notification-mark-read')).toHaveCount(1)
  })

  test('mark-all-read removes mark-read buttons across items', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'allreader@jfet.co.jp', name: 'All Reader' })
    await seedNotifications(page, {
      items: [invitationItem(false, 'A'), teamInviteItem(false, 'B')]
    })

    await page.goto('/notifications')
    await expect(page.getByTestId('notification-mark-read')).toHaveCount(2)

    await page.getByTestId('notifications-read-all').click()
    await expect(page.getByTestId('notification-mark-read')).toHaveCount(0)
  })

  test('delete removes the notification from the list', async ({ page }) => {
    await mockGoogleLogin(page, { email: 'deleter@jfet.co.jp', name: 'Deleter' })
    await seedNotifications(page, {
      items: [invitationItem(false, 'Delete Me'), mentionItem(false, 'Keep Me')]
    })

    await page.goto('/notifications')
    await expect(page.getByTestId('notification-item')).toHaveCount(2)

    await page.getByTestId('notification-item').first().getByTestId('notification-delete').click()
    await expect(page.getByTestId('notification-item')).toHaveCount(1)
  })
})
