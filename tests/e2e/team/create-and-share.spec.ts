import { expect, test } from '@playwright/test'

import { mockGoogleLogin } from '../../helpers/e2e-auth'

test('owner creates a team board and members can see it on the dashboard', async ({
  browser,
  page
}) => {
  const teamName = `Workspace ${Date.now()}`
  const boardName = `Team Board ${Date.now()}`
  const memberEmail = `member-${Date.now()}@jfet.co.jp`

  const memberContext = await browser.newContext()
  const memberPage = await memberContext.newPage()
  await mockGoogleLogin(memberPage, {
    email: memberEmail,
    name: 'Team Member'
  })

  await mockGoogleLogin(page, {
    email: 'owner-team@jfet.co.jp',
    name: 'Team Owner'
  })

  await page.goto('/teams')
  await expect(page.getByTestId('teams-view')).toBeVisible()
  await page.getByTestId('team-create-button').click()
  await page.getByTestId('team-create-input').fill(teamName)
  await page.getByTestId('team-create-submit').click()

  await expect(page.getByTestId('team-detail-view')).toBeVisible()
  await expect(page.getByText(teamName)).toBeVisible()

  await page.getByTestId('team-detail-invite-button').click()
  await page.getByTestId('team-invite-email-input').fill(memberEmail)
  await page.getByTestId('team-invite-submit').click()

  await expect(page.getByText(memberEmail)).toBeVisible()

  await page.goto('/boards')
  await expect(page.getByTestId('boards-view')).toBeVisible()
  await page.getByTestId('board-create-input').fill(boardName)
  await page.getByTestId('board-team-select').selectOption({ label: teamName })
  await page.getByTestId('board-create-button').click()

  await expect(page.getByTestId('editor-root')).toBeVisible()
  await expect(page.getByTestId('editor-team-badge')).toContainText(teamName)

  await memberPage.goto('/boards')
  await expect(memberPage.getByTestId('boards-view')).toBeVisible()
  await expect(memberPage.getByText(boardName)).toBeVisible()
  await expect(memberPage.getByTestId('board-team-badge')).toContainText(teamName)

  await memberContext.close()
})
