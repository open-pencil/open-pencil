import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { mockGoogleLogin } from '../../helpers/e2e-auth'

test('mentioning a teammate pushes a notification badge update over websocket', async ({
  browser,
  page
}) => {
  const teamName = `Mention Team ${Date.now()}`
  const boardName = `Mention Board ${Date.now()}`
  const teammateEmail = `mention-${Date.now()}@inkly.test`

  const teammateContext = await browser.newContext()
  const teammatePage = await teammateContext.newPage()
  await mockGoogleLogin(teammatePage, {
    email: teammateEmail,
    name: 'Mention Teammate'
  })

  await mockGoogleLogin(page, {
    email: 'mention-owner@inkly.test',
    name: 'Mention Owner'
  })

  await page.goto('/teams')
  await expect(page.getByTestId('teams-view')).toBeVisible()
  await page.getByTestId('team-create-button').click()
  await page.getByTestId('team-create-input').fill(teamName)
  await page.getByTestId('team-create-submit').click()

  await expect(page.getByTestId('team-detail-view')).toBeVisible()
  await page.getByTestId('team-detail-invite-button').click()
  await page.getByTestId('team-invite-email-input').fill(teammateEmail)
  await page.getByTestId('team-invite-submit').click()
  await expect(page.getByText(teammateEmail)).toBeVisible()

  await page.goto('/boards')
  await expect(page.getByTestId('boards-view')).toBeVisible()
  await page.getByTestId('board-create-input').fill(boardName)
  await page.getByTestId('board-team-select').selectOption({ label: teamName })
  await page.getByTestId('board-create-button').click()

  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await expect(page.getByTestId('editor-root')).toBeVisible()
  await expect(page.getByTestId('editor-team-badge')).toContainText(teamName)

  await teammatePage.goto('/boards')
  await expect(teammatePage.getByTestId('boards-view')).toBeVisible()
  await expect(teammatePage.getByTestId('notification-bell-badge')).toHaveText('1')

  await page.evaluate(() => {
    const store = window.inkly?.getStore?.()
    if (!store) throw new Error('Inkly store not initialized')
    const id = store.createShape('TEXT', 220, 220, 260, 32)
    store.select([id])
    store.startTextEditing(id)
  })
  await canvas.waitForRender()
  await page.waitForTimeout(200)
  const hiddenTextarea = page.locator('textarea[aria-hidden="true"]')
  await expect(hiddenTextarea).toHaveCount(1)
  await hiddenTextarea.type(`Heads up @${teammateEmail.slice(0, 8)}`)
  await page.waitForTimeout(200)
  const textEditState = await page.evaluate(() => {
    const store = window.inkly?.getStore?.()
    if (!store) throw new Error('Inkly store not initialized')
    return {
      editingTextId: store.state.editingTextId,
      text: store.textEditor?.state?.text ?? '',
      cursor: store.textEditor?.state?.cursor ?? null
    }
  })
  expect(textEditState.editingTextId).toBeTruthy()
  expect(textEditState.text).toContain('@')

  const mentionInput = page.getByTestId('mention-input')
  await expect(mentionInput).toBeVisible()
  await expect(page.getByTestId('mention-option').filter({ hasText: teammateEmail })).toBeVisible()
  await page.getByTestId('mention-option').filter({ hasText: teammateEmail }).click()

  await expect(teammatePage.getByTestId('notification-bell-badge')).toHaveText('2')

  await teammatePage.getByTestId('notification-bell-trigger').click()
  const notificationPopover = teammatePage.getByTestId('notification-bell-popover')
  await expect(notificationPopover).toBeVisible()
  await expect(notificationPopover.getByText(boardName)).toBeVisible()

  await teammateContext.close()
})
