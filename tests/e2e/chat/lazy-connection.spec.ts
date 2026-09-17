import { test, expect } from '#tests/helpers/chat/fixture'
import { injectMockChatTransport } from '#tests/helpers/chat/transport'

test('creating a new chat does not connect before an explicit submission', async ({
  configuredChat: chat,
  page
}) => {
  const probe = await page.evaluateHandle(() => {
    const setTransport = window.openPencil?.setChatTransport
    if (!setTransport) throw new Error('Transport override unavailable')
    const state = { connections: 0 }
    setTransport(() => {
      state.connections++
      return {
        async sendMessages() {
          throw new Error('Intentional test provider failure')
        },
        async reconnectToStream() {
          return null
        }
      }
    })
    return state
  })

  try {
    await page.getByRole('button', { name: 'New chat', exact: true }).click()
    await expect(chat.input).toBeVisible()
    await expect(page.getByRole('button', { name: 'New chat', exact: true })).toBeEnabled()
    expect(await probe.evaluate((state) => state.connections)).toBe(0)
    await chat.submit('Connect only for this request')
    await expect.poll(() => probe.evaluate((state) => state.connections)).toBe(1)
  } finally {
    await injectMockChatTransport(page)
    await probe.dispose()
  }
})
