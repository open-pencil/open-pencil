import type { Page } from '@playwright/test'

/**
 * Replaces the chat transport with the app's own tool loop, driven by a scripted model, so
 * replies run real tools, edit the document, and save the conversation as in production.
 * Each request creates a frame named `Card` with `render`, then answers "Done".
 * The text of the latest request is kept in `data-last-model-request` on the root element.
 */
export async function injectToolLoopTransport(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const transportsPath = '/src/app/ai/chat/transports.ts'
    const { createToolLoopTransport } = await import(transportsPath)
    const api = window.openPencil
    const store = api?.getStore?.()
    if (!api?.setChatTransport || !store) throw new Error('Chat transport override not available')

    const usage = {
      inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 1, text: 1, reasoning: undefined }
    }
    type PromptMessage = { role: string; content: unknown }
    const textOf = (message: PromptMessage | undefined) =>
      Array.isArray(message?.content)
        ? message.content.map((part: { text?: string }) => part.text ?? '').join('')
        : String(message?.content ?? '')

    let calls = 0
    const model = {
      specificationVersion: 'v4',
      provider: 'scripted',
      modelId: 'scripted',
      supportedUrls: {},
      doGenerate() {
        throw new Error('The scripted model only streams')
      },
      async doStream({ prompt }: { prompt: PromptMessage[] }) {
        const last = prompt.at(-1)
        const answering = last?.role === 'tool'
        if (!answering) {
          const request = prompt.findLast((message) => message.role === 'user')
          document.documentElement.dataset.lastModelRequest = textOf(request)
        }
        const id = `call-${++calls}`
        const chunks = answering
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id },
              { type: 'text-delta', id, delta: 'Done' },
              { type: 'text-end', id },
              { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage }
            ]
          : [
              { type: 'stream-start', warnings: [] },
              {
                type: 'tool-call',
                toolCallId: id,
                toolName: 'render',
                input: JSON.stringify({ jsx: '<Frame name="Card" w={120} h={80} />' })
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
  })
}
