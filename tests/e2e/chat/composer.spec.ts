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
  await chat.input.type('Second line')

  await expect(chat.input).toHaveValue('First line\nSecond line')
  await expect(chat.page.getByText('First line', { exact: true })).toBeHidden()
})

test('Enter submits and clears input', async ({ configuredChat: chat }) => {
  await chat.submit('Hello there')

  await expect(chat.page.getByText('Hello there', { exact: true })).toBeVisible()
  await expect(chat.input).toHaveValue('')
})
