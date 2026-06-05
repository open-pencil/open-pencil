import { expect, test } from '@playwright/test'

import { runA11yScan, expectNoCriticalViolations } from '#tests/helpers/a11y'
import { cleanState, seedBoards, seedNotifications } from '#tests/helpers/api-seed'
import { mockGoogleLogin } from '#tests/helpers/e2e-auth'
import { waitForVisualReady } from '#tests/helpers/visual'

const notificationsDisabledRules = [
  // TODO(cardene): `color-contrast` in notifications surfaces is tracked for a follow-up a11y fix PR.
  'color-contrast'
]

test.describe('notifications accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await cleanState(page)
  })

  test('empty state has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'notifications-a11y-empty@inkly.test',
      name: 'Notifications A11y Empty'
    })

    await page.goto('/notifications')
    await expect(page.getByTestId('notifications-view')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: notificationsDisabledRules
    })
    expectNoCriticalViolations(results)
  })

  test('populated state has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'notifications-a11y-populated@inkly.test',
      name: 'Notifications A11y Populated'
    })
    await seedNotifications(page, {
      items: [
        {
          type: 'invitation',
          payload: {
            invitationId: 'a11y-invitation-1',
            boardId: 'a11y-board-1',
            boardName: 'Launch Board',
            role: 'editor',
            inviterDisplayName: 'Design Lead',
            inviteeEmail: 'notifications-a11y-populated@inkly.test',
            url: '/invite/a11y-invitation-1'
          }
        },
        {
          type: 'team_invite',
          read: true,
          payload: {
            teamId: 'a11y-team-1',
            teamName: 'Research Ops',
            role: 'viewer',
            inviterDisplayName: 'Ops Owner',
            inviteeEmail: 'notifications-a11y-populated@inkly.test',
            url: '/team/a11y-team-1'
          }
        },
        {
          type: 'mention',
          payload: {
            boardId: 'a11y-board-2',
            boardName: 'Sprint Board',
            mentionedByDisplayName: 'Product Designer',
            message: 'Can you review the new header states?',
            url: '/?board=a11y-board-2&name=Sprint+Board'
          }
        }
      ]
    })

    await page.goto('/notifications')
    await expect(page.getByTestId('notification-item')).toHaveCount(3)
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      disableRules: notificationsDisabledRules
    })
    expectNoCriticalViolations(results)
  })

  test('bell popover has no critical accessibility violations', async ({ page }) => {
    await mockGoogleLogin(page, {
      email: 'notifications-a11y-popover@inkly.test',
      name: 'Notifications A11y Popover'
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
            inviteeEmail: 'notifications-a11y-popover@inkly.test',
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
        }
      ]
    })

    await page.goto('/boards')
    await page.getByTestId('notification-bell-trigger').click()
    await expect(page.getByTestId('notification-bell-popover')).toBeVisible()
    await waitForVisualReady(page)

    const results = await runA11yScan(page, {
      include: ['[data-test-id="notification-bell-popover"]'],
      disableRules: notificationsDisabledRules
    })
    expectNoCriticalViolations(results)
  })
})
