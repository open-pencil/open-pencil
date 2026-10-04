import { expect, test } from '@playwright/test'

const story = (id: string) => `/iframe.html?id=${id}&viewMode=story`

// Stories with play functions click on their own; these use ones that do not.
test("an avatar counts its person's agents and lists them on hover", async ({ page }) => {
  await page.goto(story('collaboration-presence-avatars--many-people'))
  const ana = page.getByRole('button', { name: 'Follow Ana' })
  await expect(ana).toContainText('2')
  await ana.hover()
  const card = page.getByText('Thinking · Cover')
  await expect(card).toBeVisible()
  await expect(page.getByRole('button', { name: 'Follow Orbit' })).toBeVisible()
})

test('more people than fit collapse into +N, which lists everyone', async ({ page }) => {
  await page.goto(story('collaboration-presence-avatars--many-people'))
  await page.getByRole('button', { name: '2 more' }).click()
  await expect(page.getByText('Fay')).toBeVisible()
  await expect(page.getByText('Dana (you)')).toBeVisible()
})

test('your avatar shows the room is live and opens your menu with Leave room', async ({ page }) => {
  await page.goto(story('collaboration-presence-avatars--many-people'))
  await expect(page.getByRole('img', { name: 'Connected' })).toBeVisible()
  await page.getByRole('button', { name: 'Dana (you)' }).click()
  await expect(page.getByRole('button', { name: 'Leave room' })).toBeVisible()
})

test('the follow frame names an agent with its owner and offers to stop', async ({ page }) => {
  await page.goto(story('collaboration-follow-frame--following-their-agent'))
  await expect(page.getByRole('status')).toHaveText(/Following Orbit \(Ana\)/)
  await expect(page.getByRole('button', { name: 'Stop following' })).toBeVisible()
})

test("the keyboard reaches a collaborator's agents through the room list", async ({ page }) => {
  await page.goto(story('collaboration-presence-avatars--room'))
  const everyone = page.getByRole('button', { name: 'In this room' })
  await everyone.focus()
  await everyone.press('Enter')
  const follow = page.getByRole('button', { name: 'Follow Orbit' })
  await expect(follow).toBeVisible()
  await follow.focus()
  await expect(follow).toBeFocused()
})
