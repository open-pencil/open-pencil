import { expect, test } from '@playwright/test'

import { startAgent } from '#tests/helpers/collab/agent'
import {
  collaborationErrors,
  connect,
  share,
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
    await share(host)
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

test('an MCP session shows as an agent at the layers it touches, to collaborators too', async ({
  browser
}) => {
  // Two peers in a room, a tool call, and following it, stopping, and following again.
  test.setTimeout(90_000)
  const relay = await startRelay()
  let host: Peer | null = null
  let guest: Peer | null = null
  try {
    host = await createPeer(browser, 'Host', relay.url)
    guest = await createPeer(browser, 'Guest', relay.url)
    await share(host)
    await connect(guest)
    const nodeId = await host.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      return store.graph.createNode('FRAME', store.state.currentPageId, {
        name: 'Card',
        x: 240,
        y: 160,
        width: 200,
        height: 120
      }).id
    })

    // A tool call as the MCP bridge delivers it, from a session of an outside client.
    await host.page.evaluate(
      (id) =>
        window.openPencil?.test?.automation?.('tool', {
          name: 'rename_node',
          args: { id, name: 'Checkout card' },
          agent: { session: 'session-1', kind: 'mcp', client: 'claude-code' }
        }),
      nodeId
    )
    const agent = await host.page.evaluate(() => {
      const cursor = window.openPencil
        ?.getStore?.()
        .state.presenceCursors.find((entry) => entry.kind === 'agent')
      return cursor ? { name: cursor.name, x: cursor.x, y: cursor.y } : null
    })
    expect(agent).toMatchObject({ x: 240, y: 160 })
    const name = agent?.name ?? ''

    // With Follow agents on, as by default, its owner's view follows it as soon as it works.
    const frame = host.page.getByTestId('follow-frame')
    await expect(frame).toContainText(`Following ${name}`)
    await frame.getByRole('button', { name: 'Stop following' }).click()
    await expect(frame).toHaveCount(0)

    // Its owner lists it on their avatar and can follow it again like any agent.
    await host.page.getByTestId('collab-local-avatar').click()
    const menu = host.page.getByTestId('collab-self-menu')
    await expect(menu.getByText(name)).toBeVisible()
    await menu.getByRole('button', { name: `Follow ${name}` }).click()
    await expect(frame).toContainText(`Following ${name}`)

    // Collaborators see it on its owner's avatar.
    await expect(guest.page.getByTestId('collab-peer-avatar')).toContainText('1')

    // When the session ends, the agent leaves.
    await host.page.evaluate(() =>
      window.openPencil?.test?.automation?.('agent_session_closed', { session: 'session-1' })
    )
    await expect(frame).toHaveCount(0)
    expect(collaborationErrors(host)).toEqual([])
  } finally {
    await host?.context.close()
    await guest?.context.close()
    await relay.close()
  }
})
