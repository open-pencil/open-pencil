import type { Page } from '@playwright/test'

/** What the stand-in Vision model reports for every attached image. */
const VISION_FINDINGS = 'A centered portrait on a light background.'

/**
 * Answers the Vision model's request for attached images, which goes to OpenRouter directly rather
 * than through the chat transport, so image messages never reach the network.
 */
export async function routeVisionModel(page: Page): Promise<void> {
  await page.route('https://openrouter.ai/api/v1/chat/completions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'vision-test',
        object: 'chat.completion',
        created: 0,
        model: 'test/vision',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: VISION_FINDINGS },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      })
    })
  )
}
