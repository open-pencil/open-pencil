import { expect, test } from '@playwright/test'

test('share modal creates an invitation link that redirects to the editor', async ({
  browser,
  page
}) => {
  const boardName = `Invite ${Date.now()}`

  await page.goto('/boards')
  await page.getByTestId('board-create-input').fill(boardName)
  await page.getByTestId('board-create-button').click()

  await expect(page.getByTestId('editor-root')).toBeVisible()
  await page.getByTestId('invite-share-button').click()
  await expect(page.getByTestId('share-modal')).toBeVisible()

  await page.getByTestId('share-email-input').fill('invitee@example.com')
  await page.getByTestId('share-submit').click()

  const invitationUrl = (await page.getByTestId('share-link-output').textContent())?.trim() ?? ''
  expect(invitationUrl).toMatch(/^http:\/\/localhost:1420\/invite\//)

  const inviteeContext = await browser.newContext()
  const inviteePage = await inviteeContext.newPage()
  await inviteePage.goto(invitationUrl)

  await inviteePage.waitForURL(/\/\?board=/)
  await expect(inviteePage.getByTestId('editor-root')).toBeVisible()

  await inviteeContext.close()
})
