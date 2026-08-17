import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { WebSocketServer, type WebSocket } from 'ws'

import { CanvasHelper } from '#tests/helpers/canvas'

const ROOM_ID = 'e2e-collaboration-room'

type TestRelay = {
  url: string
  pause: () => void
  resume: () => void
  queuedCount: () => number
  close: () => Promise<void>
}

async function startRelay(): Promise<TestRelay> {
  const rooms = new Map<string, Set<WebSocket>>()
  const sockets = new Map<WebSocket, { room: Set<WebSocket>; peerId: string | null }>()
  const queuedMessages: Array<{ sender: WebSocket; room: Set<WebSocket>; text: string }> = []
  let paused = false
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  server.on('connection', (socket, request) => {
    const roomId = new URL(request.url ?? '/', 'ws://127.0.0.1').searchParams.get('roomId') ?? ''
    let room = rooms.get(roomId)
    if (!room) {
      room = new Set()
      rooms.set(roomId, room)
    }
    room.add(socket)
    sockets.set(socket, { room, peerId: null })
    socket.on('message', (data) => {
      const text = data.toString()
      const message = JSON.parse(text) as { senderId?: string }
      const state = sockets.get(socket)
      if (state && message.senderId) state.peerId = message.senderId
      if (paused) {
        queuedMessages.push({ sender: socket, room, text })
        return
      }
      for (const peer of room) {
        if (peer !== socket && peer.readyState === peer.OPEN) peer.send(text)
      }
    })
    socket.on('close', () => {
      const state = sockets.get(socket)
      room?.delete(socket)
      sockets.delete(socket)
      if (!state?.peerId) return
      const leave = JSON.stringify({ type: 'leave', senderId: state.peerId })
      for (const peer of state.room) if (peer.readyState === peer.OPEN) peer.send(leave)
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve())
    server.once('error', reject)
  })
  const address = server.address()
  if (typeof address === 'string' || address === null) throw new Error('Test relay unavailable')
  return {
    url: `ws://127.0.0.1:${address.port}`,
    pause: () => {
      paused = true
    },
    resume: () => {
      paused = false
      for (const message of queuedMessages.splice(0)) {
        for (const peer of message.room) {
          if (peer !== message.sender && peer.readyState === peer.OPEN) peer.send(message.text)
        }
      }
    },
    queuedCount: () => queuedMessages.length,
    close: async () => {
      for (const room of rooms.values()) for (const socket of room) socket.terminate()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    }
  }
}

type Peer = {
  context: BrowserContext
  page: Page
  canvas: CanvasHelper
}

async function createPeer(browser: Browser, name: string, relayURL: string): Promise<Peer> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  try {
    const page = await context.newPage()
    await page.goto(`/?test&collabTransport=test&collabRelay=${encodeURIComponent(relayURL)}`)
    await page.evaluate(
      (localName) => window.openPencil?.test?.collab?.setLocalName(localName),
      name
    )
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    canvas.errors.length = 0
    return { context, page, canvas }
  } catch (error) {
    await context.close()
    throw error
  }
}

function collaborationErrors(peer: Peer): string[] {
  return peer.canvas.errors.filter((error) => !error.includes('127.0.0.1:7600'))
}

async function connect(peer: Peer) {
  await peer.page.evaluate((roomId) => {
    const collab = window.openPencil?.test?.collab
    if (!collab) throw new Error('Collaboration bridge unavailable')
    collab.connect(roomId)
  }, ROOM_ID)
}

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
        host.page.evaluate(() => window.openPencil?.getStore?.().state.remoteCursors.length)
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
        host.page.evaluate(() => window.openPencil?.getStore?.().state.remoteCursors.length)
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
