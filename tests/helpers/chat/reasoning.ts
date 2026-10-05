import type { Page } from '@playwright/test'

/** Hold reasoning open until the test explicitly completes the turn. */
export async function installReasoningTransport(page: Page): Promise<void> {
  await page.evaluate(() => {
    const bridge = window.openPencil
    if (!bridge?.setChatTransport) throw new Error('Chat transport hook is not installed')
    bridge.setChatTransport(() => ({
      async sendMessages() {
        return new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'start', messageId: crypto.randomUUID() })
            controller.enqueue({ type: 'reasoning-start', id: 'thinking' })
            controller.enqueue({
              type: 'reasoning-delta',
              id: 'thinking',
              delta: 'Inspecting the selected layout.'
            })
            window.addEventListener(
              'finish-test-reasoning',
              () => {
                controller.enqueue({ type: 'reasoning-end', id: 'thinking' })
                controller.enqueue({ type: 'text-start', id: 'answer' })
                controller.enqueue({
                  type: 'text-delta',
                  id: 'answer',
                  delta: 'Finished inspecting the layout.'
                })
                controller.enqueue({ type: 'text-end', id: 'answer' })
                controller.enqueue({ type: 'finish', finishReason: 'stop' })
                controller.close()
              },
              { once: true }
            )
          }
        })
      },
      async reconnectToStream() {
        return null
      }
    }))
  })
}

export async function finishReasoning(page: Page): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new Event('finish-test-reasoning')))
}
