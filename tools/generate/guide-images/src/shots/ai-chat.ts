import type { Page } from '@playwright/test'

import { boxOf, layerBox, settle } from '../app.ts'
import { picture, type Shot } from './shared.ts'

const CARD = `<Frame name="Trip card" w={280} h="hug" flex="col" gap={10} p={20} bg="#FFFFFF" rounded={16}>
  <Text name="Title" size={20} weight={700} color="#18181B">Weekend in Lisbon</Text>
  <Text name="Dates" size={14} color="#71717A">May 16 – 18</Text>
  <Frame name="Button" flex="row" px={16} py={10} rounded={10} bg="#2563EB">
    <Text name="Label" size={14} weight={600} color="#FFFFFF">Book the trip</Text>
  </Frame>
</Frame>`

const REQUEST = 'Make a card for a weekend trip to Lisbon with a booking button'
const ANSWER =
  'I added a **Trip card** with a title, the dates, and a button. Want a photo at the top?'

/** Adds a model in settings, as guided setup would, so the chat shows its message field. */
async function addModel(page: Page) {
  // The model picker reads models.dev; a fixed answer keeps it offline.
  await page.route('https://models.dev/api.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: '{}' })
  )
  await page.getByRole('tab', { name: 'AI' }).click()
  await page.getByTestId('provider-setup-open-settings').click()
  await page.locator('[data-model-id]').first().click()
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name: 'OpenRouter' }).click()
  await page.getByLabel('Name').fill('Claude Sonnet')
  await page.getByTestId('provider-settings-api-key').fill('sk-or-example')
  await page.getByRole('button', { name: 'Save model' }).click()
  await page.getByTestId('app-settings-done').click()
}

/**
 * Answers every message with a scripted model through the app's own tool loop: it renders
 * `jsx`, then says `answer`, so the reply runs a real tool and edits the canvas.
 */
async function scriptReply(page: Page, jsx: string, answer: string) {
  await page.evaluate(
    async ({ jsx, answer }) => {
      const transportsPath = '/src/app/ai/transports/tool-loop.ts'
      const { createToolLoopTransport } = await import(transportsPath)
      const api = window.openPencil
      const store = api?.getStore?.()
      if (!api?.setChatTransport || !store) throw new Error('Chat transport override not available')
      const usage = {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined }
      }
      let calls = 0
      const model = {
        specificationVersion: 'v4',
        provider: 'scripted',
        modelId: 'scripted',
        supportedUrls: {},
        doGenerate() {
          throw new Error('The scripted model only streams')
        },
        async doStream({ prompt }: { prompt: { role: string }[] }) {
          const id = `call-${++calls}`
          const chunks =
            prompt.at(-1)?.role === 'tool'
              ? [
                  { type: 'stream-start', warnings: [] },
                  { type: 'text-start', id },
                  { type: 'text-delta', id, delta: answer },
                  { type: 'text-end', id },
                  { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage }
                ]
              : [
                  { type: 'stream-start', warnings: [] },
                  {
                    type: 'tool-call',
                    toolCallId: id,
                    toolName: 'render',
                    input: JSON.stringify({ jsx, x: 0, y: 0 })
                  },
                  { type: 'finish', finishReason: { unified: 'tool-calls', raw: undefined }, usage }
                ]
          return {
            stream: new ReadableStream({
              start(controller) {
                for (const chunk of chunks) controller.enqueue(chunk)
                controller.close()
              }
            })
          }
        }
      }
      api.setChatTransport(() =>
        createToolLoopTransport({
          store,
          providerID: 'openai',
          model,
          effectiveModelID: 'scripted',
          maxOutputTokens: 1000,
          thinkingLevel: () => 'default'
        })
      )
    },
    { jsx, answer }
  )
}

/** Every picture on this page, by name. */
export const SHOTS: Record<string, Shot> = {
  reply: {
    // Short, so the message field sits close to the reply.
    window: { width: 1280, height: 560 },
    async take(page) {
      await addModel(page)
      await scriptReply(page, CARD, ANSWER)
      const input = page.getByRole('textbox', { name: 'Describe a change' })
      await input.fill(REQUEST)
      await input.press('Enter')
      await page.getByTestId('chat-message-assistant').last().getByText('photo').waitFor()
      await page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        const card = store?.graph.getChildren(store.state.currentPageId).at(0)
        if (!store || !card) throw new Error('The reply made no card')
        store.centerOn(card.x + card.width / 2, card.y + card.height / 2, 1.2)
      })
      await page.mouse.move(5, 300)
      await settle(page)
      const card = await layerBox(page, ['Trip card'])
      const tabs = await boxOf(page.getByRole('tab', { name: 'Design' }))
      const size = page.viewportSize()
      if (!size) throw new Error('No window')
      // From just left of the card to the window's edge, and from the panel's tabs down.
      const left = card.x - 48
      const top = tabs.y - 8
      return picture(
        page,
        { x: left, y: top, width: size.width - left, height: size.height - top },
        0
      )
    }
  }
}
