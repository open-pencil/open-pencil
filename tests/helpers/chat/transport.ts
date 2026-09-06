import type { Page } from '@playwright/test'

export async function injectMockChatTransport(page: Page): Promise<void> {
  await page.evaluate(() => {
    const setChatTransport = window.openPencil?.setChatTransport
    if (!setChatTransport) throw new Error('Transport override not available')
    let messageCounter = 0

    setChatTransport(() => ({
      async sendMessages({
        messages
      }: {
        messages: Array<{ role: string; parts: Array<{ type: string; text?: string }> }>
      }) {
        const lastUser = [...messages].reverse().find((message) => message.role === 'user')
        const text = lastUser?.parts?.find((part) => part.type === 'text')?.text ?? ''
        const messageId = `mock-msg-${++messageCounter}`
        const normalized = text.toLowerCase()
        document.documentElement.dataset.lastChatRequest = text
        const tool = normalized.includes('frame') || normalized.includes('rectangle')
        const code = normalized.includes('code block')
        const unsafeMarkdown = normalized.includes('unsafe markdown')
        const multipleParts = normalized.includes('multiple parts')
        const reasoning = normalized.includes('reasoning')

        if (normalized.includes('expired key')) {
          return new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'error', errorText: 'API key expired.' })
              controller.close()
            }
          })
        }
        if (normalized.includes('missing agent')) {
          throw new Error('Mock agent unavailable')
        }

        return new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'start', messageId })
            if (tool) enqueueToolCall(controller, messageId)
            if (reasoning) enqueueReasoning(controller)
            if (multipleParts) {
              enqueueMultipleTextParts(controller)
              return
            }
            let response = `I'll help you with: "${text}". Here's a mock response.`
            if (tool) response = 'Created a frame called "Card".'
            else if (unsafeMarkdown) {
              response = `[unsafe](javascript:alert(1)) ![embedded](data:image/svg+xml,<svg onload=alert(1)></svg>) ![approved](${window.location.origin}/assets/approved.png) ![unapproved](https://example.com/unapproved.png) ![insecure](http://example.com/insecure.png) [safe](https://openpencil.dev)`
            } else if (code) response = '```typescript\nconst greeting = "Hello"\n```'
            enqueueText(controller, response)
          }
        })
      },
      async reconnectToStream() {
        return null
      }
    }))

    function enqueueText(controller: ReadableStreamDefaultController, text: string): void {
      controller.enqueue({ type: 'text-start', id: 'text-1' })
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text })
      controller.enqueue({ type: 'text-end', id: 'text-1' })
      controller.enqueue({ type: 'finish', finishReason: 'stop' })
      controller.close()
    }

    function enqueueReasoning(controller: ReadableStreamDefaultController): void {
      controller.enqueue({ type: 'reasoning-start', id: 'reasoning-1' })
      controller.enqueue({
        type: 'reasoning-delta',
        id: 'reasoning-1',
        delta: 'Inspecting the referenced layout.'
      })
      controller.enqueue({ type: 'reasoning-end', id: 'reasoning-1' })
    }

    function enqueueMultipleTextParts(controller: ReadableStreamDefaultController): void {
      for (const [id, delta] of [
        ['text-a', 'First'],
        ['text-b', 'Second']
      ]) {
        controller.enqueue({ type: 'text-start', id })
        controller.enqueue({ type: 'text-delta', id, delta })
        controller.enqueue({ type: 'text-end', id })
      }
      controller.enqueue({ type: 'finish', finishReason: 'stop' })
      controller.close()
    }

    function enqueueToolCall(controller: ReadableStreamDefaultController, messageId: string): void {
      const toolCallId = `call-${messageId}`
      controller.enqueue({ type: 'tool-input-start', toolCallId, toolName: 'create_shape' })
      controller.enqueue({
        type: 'tool-input-delta',
        toolCallId,
        inputTextDelta: '{"type":"FRAME","x":100,"y":100,"width":200,"height":150,"name":"Card"}'
      })
      controller.enqueue({
        type: 'tool-input-available',
        toolCallId,
        toolName: 'create_shape',
        input: { type: 'FRAME', x: 100, y: 100, width: 200, height: 150, name: 'Card' }
      })
      controller.enqueue({
        type: 'tool-output-available',
        toolCallId,
        toolName: 'create_shape',
        output: { id: '0:99', type: 'FRAME', name: 'Card' }
      })
    }
  })
}
