import { expect, test } from '@playwright/test'

import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import {
  cleanState,
  seedBoards,
  seedNotifications
} from '#tests/helpers/api-seed'
import { expectPageScreenshot } from '#tests/helpers/visual'

test.describe('notifications visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('empty state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'notifications-empty@jfet.co.jp',
      name: 'Notifications Empty'
    })

    await page.goto('/notifications')
    await expect(page.getByTestId('notifications-view')).toBeVisible()
    await expectPageScreenshot(page, 'notifications-empty.png')
  })

  test('mixed read and unread state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'notifications-mixed@jfet.co.jp',
      name: 'Notifications Mixed'
    })
    await seedNotifications(page, {
      items: [
        {
          type: 'invitation',
          payload: {
            invitationId: 'invitation-1',
            boardId: 'board-1',
            boardName: 'Launch Board',
            role: 'editor',
            inviterDisplayName: 'Design Lead',
            inviteeEmail: 'notifications-mixed@jfet.co.jp',
            url: '/invite/invitation-1'
          }
        },
        {
          type: 'team_invite',
          read: true,
          payload: {
            teamId: 'team-1',
            teamName: 'Research Ops',
            role: 'viewer',
            inviterDisplayName: 'Ops Owner',
            inviteeEmail: 'notifications-mixed@jfet.co.jp',
            url: '/team/team-1'
          }
        },
        {
          type: 'mention',
          payload: {
            boardId: 'board-2',
            boardName: 'Sprint Board',
            mentionedByDisplayName: 'Product Designer',
            message: 'Can you review the new header states?',
            url: '/?board=board-2&name=Sprint+Board'
          }
        }
      ]
    })

    await page.goto('/notifications')
    await expect(page.getByTestId('notification-item')).toHaveCount(3)
    await expectPageScreenshot(page, 'notifications-mixed.png')
  })

  test('bell popover state', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'notifications-popover@jfet.co.jp',
      name: 'Notifications Popover'
    })
    await seedBoards(page, 1)
    await seedNotifications(page, {
      items: [
        {
          type: 'invitation',
          payload: {
            invitationId: 'popover-invitation',
            boardId: 'popover-board',
            boardName: 'Popover Board',
            role: 'editor',
            inviterDisplayName: 'Owner',
            inviteeEmail: 'notifications-popover@jfet.co.jp',
            url: '/invite/popover-invitation'
          }
        },
        {
          type: 'mention',
          payload: {
            boardId: 'popover-board-2',
            boardName: 'Popover Review',
            mentionedByDisplayName: 'Reviewer',
            message: 'Please check the final review copy.',
            url: '/?board=popover-board-2&name=Popover+Review'
          }
        },
        {
          type: 'team_invite',
          read: true,
          payload: {
            teamId: 'popover-team',
            teamName: 'Popover Team',
            role: 'viewer',
            inviterDisplayName: 'Team Owner',
            inviteeEmail: 'notifications-popover@jfet.co.jp',
            url: '/team/popover-team'
          }
        }
      ]
    })

    await page.goto('/boards')
    await page.getByTestId('notification-bell-trigger').click()
    await expect(page.getByTestId('notification-bell-popover')).toBeVisible()
    await expectPageScreenshot(page, 'notifications-bell-popover.png')
  })
})
