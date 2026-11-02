import { test, expect } from '#tests/helpers/chat/fixture'

test('recovering an unsaved document restores its selected conversation automatically', async ({
  configuredChat: chat,
  page
}) => {
  await page.evaluate(async () => {
    const editor = window.lawha?.getStore?.()
    if (!editor) throw new Error('Missing editor')
    editor.createShape('RECTANGLE', 100, 100, 200, 100)
    await editor.persistRecoveryNow()
  })
  await chat.submit('Conversation belonging to recovered document')
  await expect(chat.assistantMessage()).toBeVisible()
  // Switching conversations forces a durable flush; choose the original before reload.
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  await page.getByRole('button', { name: 'Conversation history', exact: true }).click()
  await page
    .getByRole('button', { name: 'Conversation belonging to recovered document', exact: true })
    .click()
  await page.reload()
  await expect(page.getByRole('alertdialog', { name: 'Recover unsaved work' })).toBeVisible()
  await page.getByRole('button', { name: 'Restore', exact: true }).click()
  await chat.chatTab.click()
  await expect(chat.userMessage()).toContainText('Conversation belonging to recovered document')
  await expect(chat.assistantMessage()).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Conversation history', exact: true })
  ).toContainText('Conversation belonging to recovered document')
})
