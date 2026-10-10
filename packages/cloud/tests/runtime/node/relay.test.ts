import { afterEach, describe, expect, test } from 'bun:test'
import { createServer, type Server } from 'node:http'

import { memoryStateStore, relaySecret, relayTicket, user } from '#cloud-tests/helpers/relay'
import {
  decodeRelayServerFrame,
  encodeRelayClientFrame,
  RELAY_CLOSE,
  RELAY_PATH,
  type RelayServerFrame
} from '#cloud/contract'
import { attachCollaborationRelay, defaultRelayURL } from '#cloud/runtime/node'
import { createCollaborationRelay } from '#cloud/server'

const cleanups: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

async function listening(maximumMessageBytes = 1_048_576) {
  const server: Server = createServer()
  const relay = createCollaborationRelay({
    authSecret: relaySecret,
    store: memoryStateStore().store,
    maximumMessageBytes,
    maximumConnectionsPerRoom: 10
  })
  const attached = attachCollaborationRelay(server, relay, maximumMessageBytes)
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected a TCP address')
  cleanups.push(async () => {
    await attached.close()
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  })
  return `ws://127.0.0.1:${address.port}`
}

function open(url: string) {
  const socket = new WebSocket(url)
  socket.binaryType = 'arraybuffer'
  const frames: RelayServerFrame[] = []
  const closed = new Promise<number>((resolve) => {
    socket.addEventListener('close', (event) => resolve(event.code))
  })
  const opened = new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve())
    socket.addEventListener('error', () => reject(new Error('WebSocket failed')))
  })
  const welcomed = new Promise<RelayServerFrame>((resolve) => {
    socket.addEventListener('message', (event: MessageEvent<ArrayBuffer>) => {
      const frame = decodeRelayServerFrame(new Uint8Array(event.data))
      if (!frame) return
      frames.push(frame)
      if (frame.type === 'welcome') resolve(frame)
    })
  })
  return { socket, frames, opened, welcomed, closed }
}

describe('Node collaboration relay listener', () => {
  test('admits a ticket holder over a real WebSocket', async () => {
    const base = await listening()
    const client = open(`${base}${RELAY_PATH}`)
    cleanups.push(async () => client.socket.close())
    await client.opened
    const documentId = crypto.randomUUID()
    client.socket.send(
      encodeRelayClientFrame({
        type: 'auth',
        token: await relayTicket({ documentId, permission: 'edit', principal: user('alice') })
      })
    )
    expect(await client.welcomed).toMatchObject({ type: 'welcome', peers: ['server'] })
  })

  test('refuses upgrades on other paths', async () => {
    const base = await listening()
    const client = open(`${base}/elsewhere`)
    expect(client.opened).rejects.toThrow()
    await client.closed
  })

  test('closes sockets that send more than the message limit', async () => {
    const base = await listening(1_024)
    const client = open(`${base}${RELAY_PATH}`)
    await client.opened
    client.socket.send(new Uint8Array(4_096))
    // ws refuses the frame with 1009 under Node; Bun's ws ignores maxPayload and the relay refuses it.
    expect([1009, RELAY_CLOSE.messageTooLarge]).toContain(await client.closed)
  })
})

describe('default relay URL', () => {
  test('uses the API origin with a WebSocket scheme', () => {
    expect(defaultRelayURL('https://cloud.example.com')).toBe(
      `wss://cloud.example.com${RELAY_PATH}`
    )
    expect(defaultRelayURL('http://localhost:8787/')).toBe(`ws://localhost:8787${RELAY_PATH}`)
  })
})
