import type { Browser, BrowserContext, Page } from '@playwright/test'
import { WebSocketServer, type WebSocket } from 'ws'

import { CanvasHelper } from '#tests/helpers/canvas'

/** Two-browser collaboration: a local WebSocket relay and peers connected through it. */
export const ROOM_ID = 'e2e-collaboration-room'

export type TestRelay = {
  url: string
  pause: () => void
  resume: () => void
  queuedCount: () => number
  close: () => Promise<void>
}

/** The sender of a relayed frame; frames that are not JSON are still forwarded. */
function senderOf(text: string): string | undefined {
  try {
    const message: unknown = JSON.parse(text)
    return typeof message === 'object' && message !== null && 'senderId' in message
      ? String(message.senderId)
      : undefined
  } catch {
    return undefined
  }
}

export async function startRelay(): Promise<TestRelay> {
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
      const state = sockets.get(socket)
      const senderId = senderOf(text)
      if (state && senderId) state.peerId = senderId
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

export type Peer = {
  context: BrowserContext
  page: Page
  canvas: CanvasHelper
}

export async function createPeer(browser: Browser, name: string, relayURL: string): Promise<Peer> {
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

export function collaborationErrors(peer: Peer): string[] {
  return peer.canvas.errors.filter((error) => !error.includes('127.0.0.1:7600'))
}

export async function connect(peer: Peer) {
  await peer.page.evaluate((roomId) => {
    const collab = window.openPencil?.test?.collab
    if (!collab) throw new Error('Collaboration bridge unavailable')
    collab.connect(roomId)
  }, ROOM_ID)
}
