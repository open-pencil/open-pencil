import { readFile } from 'node:fs/promises'

import * as v from 'valibot'

import { test, expect } from '#tests/helpers/chat/fixture'

test('mobile conversation menu stays attached to its trigger and inside the viewport', async ({
  configuredChat: chat,
  page
}) => {
  await chat.submit('Mobile menu conversation')
  await expect(chat.assistantMessage()).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('mobile-ribbon-ai').click()
  const trigger = page.getByRole('button', { name: 'Conversation actions' })
  await expect(trigger).toBeVisible()
  const triggerBox = await trigger.boundingBox()
  await trigger.click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect
    .poll(async () => {
      const box = await menu.boundingBox()
      if (!box || !triggerBox) return false
      return (
        box.x >= 0 &&
        box.x + box.width <= 390 &&
        box.y >= 0 &&
        box.y + box.height <= 844 &&
        Math.abs(box.x + box.width - triggerBox.x - triggerBox.width) < 2
      )
    })
    .toBe(true)
})

test('deleting a conversation asks in a confirmation dialog', async ({
  configuredChat: chat,
  page
}) => {
  await chat.submit('Conversation to keep')
  await expect(chat.assistantMessage()).toBeVisible()
  await page.getByRole('button', { name: 'New chat', exact: true }).first().click()
  await chat.submit('Conversation to delete')
  await expect(chat.assistantMessage()).toBeVisible()
  const actions = page.getByRole('button', { name: 'Conversation actions' })

  await actions.click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Delete this conversation permanently?' })
  await expect(dialog).toContainText('“Conversation to delete” and its messages are removed.')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  await expect(chat.userMessage()).toContainText('Conversation to delete')

  await actions.click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('chat-message-user')).toHaveCount(0)

  // The conversation is gone from storage, not only from the panel.
  await page.reload()
  await chat.chatTab.click()
  await page.getByRole('button', { name: 'Conversation history', exact: true }).click()
  await page.getByRole('button', { name: 'All documents', exact: true }).click()
  await expect(page.getByRole('button', { name: /Conversation to keep/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Conversation to delete/ })).toHaveCount(0)
})

const traceSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    conversation: v.object({ id: v.string(), title: v.string() }),
    messages: v.array(
      v.object({ message: v.object({ role: v.string(), parts: v.array(v.unknown()) }) })
    ),
    events: v.array(v.object({ name: v.string(), sessionId: v.optional(v.string()) }))
  })
)

test('a conversation saves its raw trace with tool calls and run events', async ({
  configuredChat: chat,
  page
}) => {
  // Without a save picker the browser downloads the file.
  await page.evaluate(() => Reflect.deleteProperty(window, 'showSaveFilePicker'))
  await chat.submit('Create a frame')
  await expect(
    chat.assistantMessage().getByRole('button', { name: /^Done Create Shape\b/ })
  ).toBeVisible()

  await page.getByRole('button', { name: 'Conversation actions' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Save trace…' }).click()
  ])

  const path = await download.path()
  const trace = v.parse(traceSchema, await readFile(path, 'utf8'))
  // Named after the conversation, as other exports are named after their layer or document.
  expect(download.suggestedFilename()).toBe(`${trace.conversation.title} trace.json`)
  expect(trace.messages.map((row) => row.message.role)).toEqual(['user', 'assistant'])
  expect(JSON.stringify(trace.messages[1]?.message.parts)).toContain('"toolCallId"')
  expect(trace.events.map((event) => event.name)).toContain('chat.completed')
  expect(trace.events.every((event) => event.sessionId === trace.conversation.id)).toBe(true)
})
