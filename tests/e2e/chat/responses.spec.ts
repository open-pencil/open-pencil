import { expect, test } from '#tests/helpers/chat/fixture'

test('assistant responds', async ({ configuredChat: chat }) => {
  await chat.submit('Hello there')
  await expect(chat.assistantMessage()).toContainText('mock response')
})

test('reasoning and response copy actions render', async ({ configuredChat: chat }) => {
  await chat.submit('Show reasoning')

  // Reasoning that streamed in this session reports how long the model thought.
  const reasoning = chat.assistantMessage().getByRole('button', { name: /^Thought for \d+s$/ })
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
  // The status icon's label leads the call's accessible name.
  await expect(
    chat.assistantMessage().getByRole('button', { name: /^Done Create Shape\b/ })
  ).toBeVisible()
  await expect(chat.assistantMessage().getByText('Created a frame', { exact: false })).toBeVisible()
})

test('opening a tool call at the bottom keeps it in place instead of following', async ({
  configuredChat: chat,
  page
}) => {
  await chat.submit(Array.from({ length: 60 }, (_, i) => `Context line ${i}`).join('\n'))
  await chat.submit('Create a frame')
  const trigger = chat.assistantMessage().getByRole('button', { name: /^Done Create Shape\b/ })
  await expect(trigger).toBeVisible()
  const top = async () => (await trigger.boundingBox())?.y ?? 0
  const before = await top()

  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  // Sample through the expansion: following would scroll the header up as the card grows.
  for (let frame = 0; frame < 10; frame++) {
    expect(Math.abs((await top()) - before)).toBeLessThan(2)
    await page.waitForTimeout(30)
  }
})

test('authentication errors explain the cause and link to Settings', async ({
  configuredChat: chat
}) => {
  await chat.submit('Trigger expired key error')

  const toast = chat.page.locator('[data-slot="toast"]').filter({
    hasText: 'Your provider API key is invalid or expired. Replace it in Settings.'
  })
  await expect(toast).toBeVisible()
  await expect(chat.page.locator('[data-slot="toast"]')).toHaveCount(1)
  await toast.getByRole('button', { name: 'Open settings' }).click()
  await expect(chat.page.getByTestId('app-settings-dialog')).toBeVisible()
})

test('transport errors show a safe localized toast', async ({ configuredChat: chat }) => {
  await chat.submit('Trigger missing agent error')
  await expect(
    chat.page.locator('[data-slot="toast"]').filter({
      hasText: 'The model request failed. Check the provider settings and try again.'
    })
  ).toBeVisible()
})

test('a request that failed before any reply can be retried', async ({ configuredChat: chat }) => {
  await chat.submit('Hello there')
  await expect(chat.assistantMessage()).toContainText('mock response')
  await chat.submit('Flaky request')

  const toast = chat.page.locator('[data-slot="toast"]')
  await expect(toast.getByRole('button', { name: 'Retry' })).toBeVisible()
  // The failed request offers the retry; the earlier reply does not offer to regenerate itself.
  await expect(chat.userMessage().getByTestId('chat-retry')).toBeVisible()
  await expect(chat.page.getByTestId('chat-regenerate')).toHaveCount(0)

  await chat.userMessage().getByTestId('chat-retry').click()
  await expect(chat.assistantMessage()).toContainText('Flaky request')
  await expect(chat.page.getByTestId('chat-message-user')).toHaveCount(2)
  await expect(chat.page.getByTestId('chat-message-assistant')).toHaveCount(2)
  await expect(chat.page.getByTestId('chat-message-assistant').first()).toContainText('Hello there')
  await expect(chat.page.getByTestId('chat-retry')).toHaveCount(0)
  await expect(chat.assistantMessage().getByTestId('chat-regenerate')).toBeVisible()
})
