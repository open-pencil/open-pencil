import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { ChatHarness } from '#tests/helpers/chat/harness'

const apiKey = process.env.OPENROUTER_API_KEY

if (!apiKey) throw new Error('OPENROUTER_API_KEY is required for real LLM smoke tests')

test.describe('OpenRouter chat', { tag: '@real-llm' }, () => {
  test('streams a Markdown response from the configured Design model', async ({ page }) => {
    const chat = new ChatHarness(page)
    await chat.open()
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await chat.configureOpenRouter(apiKey)
    await chat.submit(
      'Reply with a short Markdown heading and a TypeScript code block declaring const ready = true. Do not call tools.'
    )

    const assistant = chat.assistantMessage()
    await expect(assistant.locator('.chat-markdown')).toBeVisible({ timeout: 60_000 })
    await expect(assistant.locator('.shiki')).toContainText('const ready = true', {
      timeout: 60_000
    })
    await expect(assistant.locator('.chat-markdown')).toHaveAttribute(
      'data-chat-markdown-mode',
      'static'
    )
  })
})
