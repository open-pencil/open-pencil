import type { Page, WebSocketRoute } from '@playwright/test'

import { test as base, expect } from '#tests/helpers/chat/fixture'

type Reload = 'update' | 'restart'

/** Delivers Vite reloads and disconnects without restarting the shared test server. */
const test = base.extend<{
  /** An unsaved document's leave prompt is answered by leaving, or with `stay` by staying. */
  reloadFrontend: (reason: Reload, options?: { stay?: boolean }) => Promise<void>
}>({
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
      await use(async (reason, { stay = false } = {}) => {
        if (!connection) throw new Error('Vite did not connect')
        const asked = new Promise<void>((resolve) => {
          page.once('dialog', (dialog) => {
            void (stay ? dialog.dismiss() : dialog.accept()).then(resolve)
          })
        })
        const settled = stay ? asked : page.waitForEvent('load')
        if (reason === 'update') connection.send(JSON.stringify({ type: 'full-reload', path: '*' }))
        else await connection.close()
        await settled
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

async function editDocument(page: Page) {
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    store.createShape('RECTANGLE', 100, 100, 100, 100)
  })
  await expect(page.getByRole('img', { name: 'Unsaved changes' })).toBeVisible()
}

for (const reason of ['update', 'restart'] as const) {
  test(`a development ${reason} that asks about an unsaved document keeps the chat for a user who stays`, async ({
    configuredChat: chat,
    page,
    reloadFrontend
  }) => {
    await editDocument(page)
    await chat.submit('before the reload')
    await expect(chat.assistantMessage()).toContainText('before the reload')
    await reloadFrontend(reason, { stay: true })
    await chat.submit('after staying')
    await expect(chat.assistantMessage().last()).toContainText('after staying')
  })
}

test('a development update that an unsaved document asks about saves the reply before asking', async ({
  configuredChat: chat,
  page,
  reloadFrontend
}) => {
  await editDocument(page)
  await chat.submit('paused short stream')
  await expect(chat.assistantMessage()).toContainText('Line 1')
  await reloadFrontend('update')
  await chat.chatTab.click()
  await page.getByRole('button', { name: 'Conversation history', exact: true }).click()
  await page.getByRole('button', { name: 'All documents', exact: true }).click()
  await page.getByRole('button', { name: /paused short stream/ }).click()
  await expect(chat.assistantMessage()).toContainText('Line 1')
})
