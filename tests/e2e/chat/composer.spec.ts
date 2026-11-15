import { expect, test } from '#tests/helpers/chat/fixture'

test('composer enables submission only for non-empty input', async ({ configuredChat: chat }) => {
  await expect(chat.sendButton).toBeDisabled()
  await chat.input.fill('Make a red rectangle')
  await expect(chat.sendButton).toBeEnabled()
})

test('composer grows with multiline input', async ({ configuredChat: chat }) => {
  await chat.input.fill('First line')
  const initialHeight = (await chat.input.boundingBox())?.height ?? 0
  await chat.input.fill(Array.from({ length: 8 }, (_, index) => `Line ${index + 1}`).join('\n'))
  await expect
    .poll(async () => (await chat.input.boundingBox())?.height ?? 0)
    .toBeGreaterThan(initialHeight)
})

test('Shift+Enter inserts a line break without submitting', async ({ configuredChat: chat }) => {
  await chat.input.fill('First line')
  await chat.input.press('Shift+Enter')
  await chat.input.pressSequentially('Second line')

  await expect(chat.input.locator('.cm-line')).toHaveText(['First line', 'Second line'])
  await expect(chat.page.getByTestId('chat-message-user')).toHaveCount(0)
})

test('Enter submits and clears input', async ({ configuredChat: chat }) => {
  await chat.submit('Hello there')

  await expect(chat.userMessage()).toHaveText('Hello there')
  await expect(chat.input).not.toContainText('Hello there')
  await expect(chat.sendButton).toBeDisabled()
})
