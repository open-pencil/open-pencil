import { expect, test } from '@playwright/test'

const story = (name: string) =>
  `/iframe.html?id=app-collaboration-presence-list--${name}&viewMode=story`

test('lists people with their agents and what each agent is doing', async ({ page }) => {
  await page.goto(story('room'))
  const list = page.getByRole('list').first()
  await expect(list.getByText('Dana (you)')).toBeVisible()
  await expect(list.getByText('Editing · Checkout')).toBeVisible()
  await expect(list.getByText('Thinking · Cover')).toBeVisible()
  await expect(list.getByText('Idle', { exact: true })).toBeVisible()
  await expect(list.getByRole('button', { name: 'Follow Ana' })).toBeVisible()
  await expect(list.getByRole('button', { name: 'Follow Dana' })).toHaveCount(0)
  await expect(list.getByRole('button', { name: 'Rename Orbit' })).toHaveCount(0)
})

test('renames your own agent inline', async ({ page }) => {
  await page.goto(story('room'))
  await page.getByRole('button', { name: 'Rename Fern' }).click()
  const input = page.getByRole('textbox', { name: 'Agent name' })
  await expect(input).toBeFocused()
  await input.press('Escape')
  await expect(input).toHaveCount(0)
})

test('offers to stop following the followed agent', async ({ page }) => {
  await page.goto(story('following-an-agent'))
  await expect(page.getByRole('button', { name: 'Stop following Orbit' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Follow Fern' })).toBeVisible()
})
