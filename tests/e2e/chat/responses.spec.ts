import { expect, test } from '#tests/helpers/chat/fixture'

test('assistant responds', async ({ configuredChat: chat }) => {
  await chat.submit('Hello there')
  await expect(chat.assistantMessage()).toContainText('mock response')
})

test('reasoning and response copy actions render', async ({ configuredChat: chat }) => {
  await chat.submit('Show reasoning')

  const reasoning = chat.assistantMessage().getByRole('button', { name: 'Reasoning' })
  await expect(reasoning).toHaveAttribute('data-state', 'closed')
  await reasoning.click()
  await expect(reasoning).toHaveAttribute('data-state', 'open')
  await expect(
    chat.assistantMessage().locator('[data-slot="chat-reasoning-content"]')
  ).toBeVisible()
  await expect(chat.assistantMessage().getByRole('button', { name: 'Copy response' })).toBeVisible()
})

test('multipart assistant messages expose one copy action', async ({ configuredChat: chat }) => {
  await chat.submit('Show multiple parts')
  await expect(chat.assistantMessage()).toContainText('Second')
  await expect(chat.assistantMessage().getByRole('button', { name: 'Copy response' })).toHaveCount(
    1
  )
})

test('tool calls render their result', async ({ configuredChat: chat }) => {
  await chat.submit('Create a frame')
  await expect(chat.assistantMessage().getByText('Create Shape')).toBeVisible()
  await expect(chat.assistantMessage().getByText('Done')).toBeVisible()
  await expect(chat.assistantMessage().getByText('Created a frame', { exact: false })).toBeVisible()
})

test('authentication errors explain the cause and link to Settings', async ({
  configuredChat: chat
}) => {
  await chat.submit('Trigger expired key error')

  const toast = chat.page.getByTestId('toast-item').filter({
    hasText: 'Your provider API key is invalid or expired. Replace it in Settings.'
  })
  await expect(toast).toBeVisible()
  await expect(chat.page.getByTestId('toast-item')).toHaveCount(1)
  await toast.getByRole('button', { name: 'Open settings' }).click()
  await expect(chat.page.getByTestId('app-settings-dialog')).toBeVisible()
})

test('transport errors show a safe localized toast', async ({ configuredChat: chat }) => {
  await chat.submit('Trigger missing agent error')
  await expect(
    chat.page.getByTestId('toast-item').filter({
      hasText: 'The model request failed. Check the provider settings and try again.'
    })
  ).toBeVisible()
})
