import { expect, test } from '@playwright/test'

import {
  collaborationErrors,
  connect,
  createPeer,
  startRelay,
  type Peer
} from '#tests/helpers/collab/room'

test('mobile presence popover returns focus and disconnects the peer', async ({ browser }) => {
  const relay = await startRelay()
  let peer: Peer | null = null
  try {
    peer = await createPeer(browser, 'Mobile', relay.url)
    await peer.page.setViewportSize({ width: 390, height: 844 })
    await connect(peer)
    const trigger = peer.page.getByRole('button', { name: 'Online: 1', exact: true })
    await expect(trigger).toBeVisible()
    await trigger.focus()
    await trigger.press('Enter')
    await expect(peer.page.getByRole('button', { name: 'Disconnect', exact: true })).toBeVisible()
    await peer.page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await trigger.press('Space')
    await peer.page.getByRole('button', { name: 'Disconnect', exact: true }).click()
    await expect(trigger).toHaveCount(0)
    expect(collaborationErrors(peer)).toEqual([])
  } finally {
    await peer?.context.close()
    await relay.close()
  }
})

test('two browser peers synchronize editing, awareness, departure, and reconnect', async ({
  browser
}) => {
  test.setTimeout(120_000)
  const relay = await startRelay()
  let host: Peer | null = null
  let guest: Peer | null = null
  try {
    host = await createPeer(browser, 'Host', relay.url)
    guest = await createPeer(browser, 'Guest', relay.url)

    await connect(host)
    await connect(guest)
    await expect
      .poll(() => host.page.evaluate(() => window.openPencil?.test?.collab?.peerCount()))
      .toBe(1)
    await expect
      .poll(() => guest.page.evaluate(() => window.openPencil?.test?.collab?.peerCount()))
      .toBe(1)

    const nodeId = await host.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const node = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
        name: 'Shared rectangle',
        x: 160,
        y: 140,
        width: 120,
        height: 80
      })
      store.requestRender()
      return node.id
    })

    await expect
      .poll(() =>
        guest.page.evaluate((id) => window.openPencil?.getStore?.().graph.getNode(id)?.name, nodeId)
      )
      .toBe('Shared rectangle')

    await guest.page.evaluate((id) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.updateNode(id, { name: 'Edited by Guest', x: 320 })
      store.select([id])
      window.openPencil?.test?.collab?.updateSelection([id])
    }, nodeId)

    await expect
      .poll(() =>
        host.page.evaluate((id) => window.openPencil?.getStore?.().graph.getNode(id)?.name, nodeId)
      )
      .toBe('Edited by Guest')
    await expect
      .poll(() => host.page.evaluate(() => window.openPencil?.test?.collab?.peerSelections()[0]))
      .toEqual([nodeId])

    relay.pause()
    await guest.page.evaluate((id) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.updateNode(id, { y: 280 })
    }, nodeId)
    await host.page.evaluate((id) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.updateNode(id, { name: 'Host partition edit' })
    }, nodeId)
    await expect.poll(() => relay.queuedCount()).toBeGreaterThan(0)
    relay.resume()
    for (const peer of [host, guest]) {
      await expect
        .poll(() =>
          peer.page.evaluate((id) => {
            const node = window.openPencil?.getStore?.().graph.getNode(id)
            return node ? { name: node.name, y: node.y } : null
          }, nodeId)
        )
        .toEqual({ name: 'Host partition edit', y: 280 })
    }

    await guest.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      window.openPencil?.test?.collab?.updateCursor(420, 260, store.state.currentPageId)
    })
    await expect
      .poll(() =>
        host.page.evaluate(() => window.openPencil?.getStore?.().state.presenceCursors.length)
      )
      .toBe(1)

    expect(collaborationErrors(guest)).toEqual([])
    await guest.context.close()
    guest = null
    await expect
      .poll(() => host.page.evaluate(() => window.openPencil?.test?.collab?.peerCount()))
      .toBe(0)
    await expect
      .poll(() =>
        host.page.evaluate(() => window.openPencil?.getStore?.().state.presenceCursors.length)
      )
      .toBe(0)

    const reconnectingGuest = await createPeer(browser, 'Guest', relay.url)
    try {
      await host.page.evaluate((id) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.updateNode(id, { name: 'Edited while offline', y: 260 })
      }, nodeId)
      await connect(reconnectingGuest)
      await expect
        .poll(() =>
          reconnectingGuest.page.evaluate(
            (id) => window.openPencil?.getStore?.().graph.getNode(id)?.name,
            nodeId
          )
        )
        .toBe('Edited while offline')
      await expect
        .poll(() => host.page.evaluate(() => window.openPencil?.test?.collab?.peerCount()))
        .toBe(1)
      expect(collaborationErrors(reconnectingGuest)).toEqual([])
    } finally {
      await reconnectingGuest.context.close()
    }

    expect(collaborationErrors(host)).toEqual([])
  } finally {
    try {
      await guest?.context.close()
    } finally {
      try {
        await host?.context.close()
      } finally {
        await relay.close()
      }
    }
  }
})
