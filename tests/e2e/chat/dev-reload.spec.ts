import type { WebSocketRoute } from '@playwright/test'

import { test as base, expect } from '#tests/helpers/chat/fixture'

type Reload = 'update' | 'restart'

/** Delivers Vite reloads and disconnects without restarting the shared test server. */
const test = base.extend<{ reloadFrontend: (reason: Reload) => Promise<void> }>({
  reloadFrontend: [
    async ({ page, baseURL }, use) => {
      if (!baseURL) throw new Error('Missing app URL')
      const host = new URL(baseURL).host
      let connection: WebSocketRoute | undefined
      await page.routeWebSocket(
        (url) => url.host === host && url.pathname === '/',
        (socket) => {
          connection = socket
          socket.connectToServer()
        }
      )
      await use(async (reason) => {
        if (!connection) throw new Error('Vite did not connect')
        const loaded = page.waitForEvent('load')
        if (reason === 'update') connection.send(JSON.stringify({ type: 'full-reload', path: '*' }))
        else await connection.close()
        await loaded
      })
    },
    { auto: true }
  ]
})

for (const reason of ['update', 'restart'] as const) {
  test(`a development ${reason} saves and settles the reply before replacing the page`, async ({
    configuredChat: chat,
    page,
    reloadFrontend
  }) => {
    await chat.submit('paused short stream')
    await expect(chat.assistantMessage()).toContainText('Line 1')
    await reloadFrontend(reason)
    await chat.chatTab.click()
    await page.getByRole('button', { name: 'Conversation history', exact: true }).click()
    await page.getByRole('button', { name: 'All documents', exact: true }).click()
    await page.getByRole('button', { name: /paused short stream/ }).click()
    await expect(chat.assistantMessage()).toContainText('Line 1')
    await expect(chat.assistantMessage().locator('[data-slot="chat-turn-stopped"]')).toBeVisible()
  })
}
