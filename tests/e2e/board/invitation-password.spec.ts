import { expect, test } from '@playwright/test'

import { mockGoogleLogin } from '#tests/helpers/e2e-auth'

test('redeem invitation with email + password opens the board', async ({ browser, page }) => {
  const inviterEmail = `inviter-${Date.now()}@jfet.co.jp`
  // invitee は guest 経路の検証のため、 jfet ドメイン外を使う (@external.test)。
  const inviteeEmail = `invitee-${Date.now()}@external.test`
  const inviteePassword = 'invitee-password-123'
  const boardName = `Invite Password ${Date.now()}`

  // host (Google 経由 inviter) — board 作成 + 招待 URL 発行
  await mockGoogleLogin(page, { email: inviterEmail, name: 'Inviter' })
  await page.goto('/boards')
  await page.getByTestId('board-create-input').fill(boardName)
  await page.getByTestId('board-create-button').click()
  await expect(page.getByTestId('editor-root')).toBeVisible()
  await page.getByTestId('invite-share-button').click()
  await expect(page.getByTestId('share-modal')).toBeVisible()
  await page.getByTestId('share-email-input').fill(inviteeEmail)
  await page.getByTestId('share-submit').click()
  const invitationUrl =
    (await page.getByTestId('share-link-output').textContent())?.trim() ?? ''
  expect(invitationUrl).toMatch(/\/invite\//)

  // 招待された人 (新規 user) — invite URL を別 context で開いて email + password で redeem
  const inviteeContext = await browser.newContext()
  const inviteePage = await inviteeContext.newPage()
  await inviteePage.goto(invitationUrl)

  await expect(inviteePage.getByTestId('invite-redirect-view')).toBeVisible()
  await expect(inviteePage.getByTestId('invite-mode-signup')).toBeVisible()

  await inviteePage.getByTestId('invite-name-input').fill('Invitee User')
  await inviteePage.getByTestId('invite-email-input').fill(inviteeEmail)
  await inviteePage.getByTestId('invite-password-input').fill(inviteePassword)
  await inviteePage.getByTestId('invite-submit-button').click()

  // redeem 後は board に遷移し editor が見える
  await inviteePage.waitForURL(/\/board\//, { timeout: 15_000 })
  await expect(inviteePage.getByTestId('editor-root')).toBeVisible()

  // 戻ってきても guest dashboard に招待 board が出る (collaborator 経由)。
  // guest user (@jfet.co.jp) は /boards に行けず /dashboard で GuestDashboardView を見る。
  await inviteePage.goto('/dashboard')
  await expect(inviteePage.getByTestId('guest-dashboard-view')).toBeVisible()
  await expect(inviteePage.getByText(boardName)).toBeVisible()

  await inviteeContext.close()
})
