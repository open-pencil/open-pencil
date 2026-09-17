import { test, expect } from '#tests/helpers/chat/fixture'

test('multiple conversations preserve messages and manual titles', async ({
  configuredChat: chat,
  page
}) => {
  await chat.submit('Create the first dashboard')
  await expect(chat.assistantMessage()).toBeVisible()
  await page.getByRole('button', { name: 'New chat', exact: true }).first().click()
  await expect(chat.input).toBeVisible()
  await expect(page.getByTestId('chat-message-user')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Conversation actions' })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'All chats' })).toHaveCount(0)
  await chat.submit('Create the second dashboard')
  await expect(chat.assistantMessage()).toBeVisible()
  await page.getByRole('button', { name: 'Conversation history', exact: true }).click()
  await page.getByRole('textbox', { name: 'Search conversations…' }).fill('first dashboard')
  await expect(
    page.getByRole('button', { name: 'Create the second dashboard', exact: true })
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Create the first dashboard', exact: true }).click()
  await expect(chat.userMessage()).toContainText('Create the first dashboard')
  const actions = page.getByRole('button', { name: 'Conversation actions' })
  const triggerBox = await actions.boundingBox()
  await actions.click()
  const menuBox = await page.getByRole('menu').boundingBox()
  expect(triggerBox).not.toBeNull()
  expect(menuBox).not.toBeNull()
  if (!triggerBox || !menuBox) throw new Error('Missing menu geometry')
  expect(Math.abs(menuBox.x + menuBox.width - triggerBox.x - triggerBox.width)).toBeLessThan(2)
  expect(Math.abs(menuBox.y - triggerBox.y - triggerBox.height - 6)).toBeLessThan(2)
  await expect(page.getByRole('menuitem')).toHaveText(['Rename', 'Delete'])
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click()
  await page.getByRole('textbox', { name: 'Conversation title' }).fill('First design')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Conversation history', exact: true })
  ).toContainText('First design')
})

test('saved transcripts remain readable after reload without provider setup', async ({
  configuredChat: chat,
  page
}) => {
  await chat.submit('A durable conversation')
  await expect(chat.assistantMessage()).toBeVisible()
  await page.getByRole('button', { name: 'New chat', exact: true }).first().click()
  await page.reload()
  await chat.chatTab.click()
  await page.getByRole('button', { name: 'Conversation history', exact: true }).click()
  await page.getByRole('button', { name: 'All documents', exact: true }).click()
  await page.getByRole('button', { name: /A durable conversation/ }).click()
  await expect(chat.userMessage()).toContainText('A durable conversation')
  await expect(chat.assistantMessage()).toBeVisible()
})
