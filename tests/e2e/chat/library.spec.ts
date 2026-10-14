import { test, expect } from '#tests/helpers/chat/fixture'

test('reopening a design from the library restores its selected conversation', async ({
  configuredChat: chat,
  page
}) => {
  await page.evaluate(async () => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Missing editor')
    editor.createShape('RECTANGLE', 100, 100, 200, 100)
    editor.renameDocument('Chat design')
    await editor.persistNow()
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
  await page.getByTestId('tabbar-home').click()
  await page
    .getByTestId('recent-files-home')
    .getByRole('button', { name: /Chat design/ })
    .click()
  await chat.chatTab.click()
  await expect(chat.userMessage()).toContainText('Conversation belonging to recovered document')
  await expect(chat.assistantMessage()).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Conversation history', exact: true })
  ).toContainText('Conversation belonging to recovered document')
})
