import { expect, test } from '@playwright/test'

import { mockGoogleLogin } from '#tests/helpers/e2e-auth'

test('share modal creates an invitation link that opens the editor for an already-authed invitee', async ({
  browser,
  page
}) => {
  const hostEmail = `host-${Date.now()}@jfet.co.jp`
  const inviteeEmail = `invitee-${Date.now()}@jfet.co.jp`
  const boardName = `Invite ${Date.now()}`

  // host (jfet user 想定) — board 作成 + 招待 URL 発行
  await mockGoogleLogin(page, { email: hostEmail, name: 'Host User' })
  await page.goto('/boards')
  await page.getByTestId('board-create-input').fill(boardName)
  await page.getByTestId('board-create-button').click()

  await expect(page.getByTestId('editor-root')).toBeVisible()
  await page.getByTestId('invite-share-button').click()
  await expect(page.getByTestId('share-modal')).toBeVisible()

  await page.getByTestId('share-email-input').fill(inviteeEmail)
  await page.getByTestId('share-submit').click()

  const invitationUrl = (await page.getByTestId('share-link-output').textContent())?.trim() ?? ''
  expect(invitationUrl).toMatch(/^http:\/\/localhost:1420\/invite\//)

  // 招待された人が既に Google 経由で auth 済の場合の経路。 InviteRedirectView は
  // auth.isAuthenticated を見て auto で /board/:id へ replace する想定。
  const inviteeContext = await browser.newContext()
  const inviteePage = await inviteeContext.newPage()
  await mockGoogleLogin(inviteePage, { email: inviteeEmail, name: 'Invitee User' })
  await inviteePage.goto(invitationUrl)

  await inviteePage.waitForURL(/\/board\//, { timeout: 15_000 })
  await expect(inviteePage.getByTestId('editor-root')).toBeVisible()

  await inviteeContext.close()
})
