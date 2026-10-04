import { expect, test } from '@playwright/test'

import { startAgent } from '#tests/helpers/collab/agent'
import {
  collaborationErrors,
  connect,
  createPeer,
  startRelay,
  type Peer
} from '#tests/helpers/collab/room'

function pageNames(peer: Peer) {
  return peer.page.evaluate(
    () =>
      window.openPencil
        ?.getStore?.()
        .graph.getPages()
        .map((page) => page.name) ?? []
  )
}

test("a guest's agent shows on their avatar and can be followed until Escape", async ({
  browser
}) => {
  const relay = await startRelay()
  let host: Peer | null = null
  let guest: Peer | null = null
  try {
    host = await createPeer(browser, 'Host', relay.url)
    guest = await createPeer(browser, 'Guest', relay.url)
    await connect(host)
    await connect(guest)
    await expect
      .poll(() => host?.page.evaluate(() => window.openPencil?.test?.collab?.peerCount()))
      .toBe(1)

    await host.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.graph.addPage('Checkout')
    })
    const peer = guest
    await expect.poll(() => pageNames(peer)).toContain('Checkout')
    const agent = await startAgent(guest.page, 'Checkout', 300, 200)

    // The guest's avatar carries a count of their agents; hovering lists them.
    const avatar = host.page.getByTestId('collab-peer-avatar')
    await expect(avatar).toContainText('1')
    await avatar.hover()
    const card = host.page.getByTestId('collab-peer-card')
    await expect(card.getByText(agent.name)).toBeVisible()
    await expect(card.getByText('Editing · Checkout')).toBeVisible()

    await card.getByRole('button', { name: `Follow ${agent.name}` }).click()
    await expect
      .poll(() => host?.page.evaluate(() => window.openPencil?.getStore?.().state.currentPageId))
      .toBe(agent.pageId)
    const frame = host.page.getByTestId('follow-frame')
    await expect(frame).toContainText(`Following ${agent.name}`)

    await host.page.keyboard.press('Escape')
    await expect(frame).toHaveCount(0)
    expect(collaborationErrors(host)).toEqual([])
  } finally {
    await host?.context.close()
    await guest?.context.close()
    await relay.close()
  }
})
