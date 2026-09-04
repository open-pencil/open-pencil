import { test as base, expect } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { ChatHarness } from '#tests/helpers/chat/harness'
import { injectMockChatTransport } from '#tests/helpers/chat/transport'

interface ChatFixtures {
  chat: ChatHarness
  configuredChat: ChatHarness
}

export const test = base.extend<ChatFixtures>({
  chat: async ({ page }, use) => {
    const harness = new ChatHarness(page)
    await harness.open()
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await injectMockChatTransport(page)
    await use(harness)
  },
  configuredChat: async ({ chat }, use) => {
    await chat.configureOpenRouter('sk-or-test-key-12345')
    await use(chat)
  }
})

export { expect }
