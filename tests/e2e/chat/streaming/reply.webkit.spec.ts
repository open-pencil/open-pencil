import { CanvasHelper } from '#tests/helpers/canvas'
import { test, expect } from '#tests/helpers/chat/fixture'
import { finishReasoning, installReasoningTransport } from '#tests/helpers/chat/reasoning'

test('streams reasoning and a reply in WebKit without page errors', async ({
  configuredChat: chat,
  page
}) => {
  const canvas = new CanvasHelper(page)
  await installReasoningTransport(page)
  await chat.submit('Inspect the layout')
  await expect(page.locator('[data-slot="chat-reasoning-trigger"]').last()).toBeVisible()
  await finishReasoning(page)
  await expect(chat.assistantMessage()).toContainText('Finished inspecting')
  canvas.assertNoErrors()
})
