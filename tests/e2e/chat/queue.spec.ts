import type { Page } from '@playwright/test'

import { expect, test } from '#tests/helpers/chat/fixture'

/** The mock streams two lines, then waits for this event before it finishes the reply. */
async function finishPausedReply(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('mock-chat-continue')))
}

test('a message written while the agent works waits, then goes next', async ({
  configuredChat: chat
}) => {
  const { page } = chat
  await chat.submit('paused short stream')
  // The mock has streamed its first lines and now waits for `finishPausedReply`.
  await expect(chat.assistantMessage()).toContainText('Line 1')

  await chat.input.click()
  await page.keyboard.type('Make it blue')
  await page.keyboard.press('Enter')
  const queued = page.getByTestId('chat-queued-message')
  await expect(queued).toHaveAttribute('data-kind', 'steer')
  await expect(queued).toContainText('Make it blue')

  await page.keyboard.type('Then add a caption')
  await page.keyboard.press('Alt+Enter')
  await expect(queued).toHaveCount(2)
  await expect(queued.nth(1)).toHaveAttribute('data-kind', 'follow-up')

  await finishPausedReply(page)
  await expect(page.getByTestId('chat-message-user')).toHaveCount(3)
  await expect(page.getByTestId('chat-message-user').nth(1)).toContainText('Make it blue')
  await expect(page.getByTestId('chat-message-user').nth(2)).toContainText('Then add a caption')
  await expect(queued).toHaveCount(0)
})

test('Up takes waiting messages back to edit', async ({ configuredChat: chat }) => {
  const { page } = chat
  await chat.submit('paused short stream')
  await expect(chat.assistantMessage()).toContainText('Line 1')
  await chat.input.click()
  await page.keyboard.type('Make it blue')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('chat-queued-message')).toHaveCount(1)

  await page.keyboard.press('ArrowUp')
  await expect(page.getByTestId('chat-queued-message')).toHaveCount(0)
  await expect(chat.input).toContainText('Make it blue')
  await finishPausedReply(page)
})

test('Escape stops the reply and sends what waits at once', async ({ configuredChat: chat }) => {
  const { page } = chat
  await chat.submit('paused short stream')
  await expect(chat.assistantMessage()).toContainText('Line 1')
  await chat.input.click()
  await page.keyboard.type('Actually, make it red')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('chat-queued-message')).toHaveCount(1)

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('chat-message-user').nth(1)).toContainText('Actually, make it red')
  await expect(page.getByTestId('chat-queued-message')).toHaveCount(0)
})
