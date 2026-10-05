import type { Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { expect, test } from '#tests/helpers/chat/fixture'
import { injectToolLoopTransport } from '#tests/helpers/chat/tool-loop'

const cardCount = (page: Page) =>
  page.evaluate(() => {
    const graph = window.openPencil?.getStore?.().graph
    return graph ? [...graph.nodes.values()].filter((node) => node.name === 'Card').length : -1
  })

test('reverting a reply undoes its edits, marks it, saves the chat, and tells the model', async ({
  configuredChat: chat,
  page
}) => {
  const canvas = new CanvasHelper(page)
  await injectToolLoopTransport(page)

  await chat.submit('Add a card')
  await expect(chat.assistantMessage()).toContainText('Done')
  expect(await cardCount(page)).toBe(1)

  await chat.assistantMessage().getByTestId('chat-revert-turn').click()
  expect(await cardCount(page)).toBe(0)

  // Restore redoes the edits, then reverting again leaves the reply marked.
  await chat.assistantMessage().getByTestId('chat-restore-turn').click()
  expect(await cardCount(page)).toBe(1)
  await chat.assistantMessage().getByTestId('chat-revert-turn').click()
  expect(await cardCount(page)).toBe(0)

  await chat.submit('Try something else')
  await expect(page.getByTestId('chat-message-assistant')).toHaveCount(2)
  await expect(chat.assistantMessage()).toContainText('Done')
  const request = await page.evaluate(() => document.documentElement.dataset.lastModelRequest)
  expect(request).toContain(
    'The user reverted every document edit from one of your earlier replies'
  )
  // The note is for the model only.
  await expect(chat.userMessage()).toHaveText('Try something else')
  // The second reply's edits closed Redo, so the first reply is marked instead.
  await expect(
    page.getByTestId('chat-message-assistant').first().locator('[data-slot="chat-turn-reverted"]')
  ).toBeVisible()

  // Saving the conversation, which every send and the revert trigger, must not fail.
  canvas.assertNoErrors()

  // The mark is stored with the conversation; wait for the save before reloading drops it.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const historyPath = '/src/app/ai/chat/history/idb.ts'
        const { createConversationStore } = await import(historyPath)
        const store = createConversationStore()
        const [latest] = await store.list(undefined)
        const conversation = latest ? await store.read(latest.id) : null
        return (
          conversation?.messages.some(
            (entry: { message: { metadata?: { reverted?: boolean } } }) =>
              entry.message.metadata?.reverted === true
          ) ?? false
        )
      })
    )
    .toBe(true)
  await page.reload()
  await chat.chatTab.click()
  await page.getByRole('button', { name: 'Conversation history', exact: true }).click()
  await page.getByRole('button', { name: 'All documents', exact: true }).click()
  await page.getByRole('button', { name: /Add a card/ }).click()
  await expect(
    page.getByTestId('chat-message-assistant').first().locator('[data-slot="chat-turn-reverted"]')
  ).toBeVisible()
})
