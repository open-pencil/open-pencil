import { test as base, expect } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { routeModelCatalog } from '#tests/helpers/chat/catalog'
import { ChatHarness } from '#tests/helpers/chat/harness'
import { injectMockChatTransport } from '#tests/helpers/chat/transport'
import { routeVisionModel } from '#tests/helpers/chat/vision'

interface ChatFixtures {
  chat: ChatHarness
  configuredChat: ChatHarness
}

export const test = base.extend<ChatFixtures>({
  chat: async ({ page }, use) => {
    await routeModelCatalog(page)
    await routeVisionModel(page)
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
