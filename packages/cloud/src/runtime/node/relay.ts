import type { IncomingMessage, Server } from 'node:http'
import type { Duplex } from 'node:stream'

import { RELAY_PATH } from '#cloud/contract'
import type { CollaborationRelay } from '#cloud/server'
import { WebSocketServer, type RawData } from 'ws'

function bytes(data: RawData): Uint8Array {
  if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data))
  return data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data)
}

/**
 * Accepts WebSocket upgrades on the relay path of an HTTP server and hands each socket to the
 * relay. Other upgrade requests are refused.
 */
export function attachCollaborationRelay(
  server: Pick<Server, 'on' | 'off'>,
  relay: CollaborationRelay,
  maximumMessageBytes: number
) {
  // ws enforces the limit before buffering; the relay checks again for other runtimes.
  const sockets = new WebSocketServer({ noServer: true, maxPayload: maximumMessageBytes })

  function upgrade(request: IncomingMessage, socket: Duplex, head: Buffer) {
    const path = new URL(request.url ?? '/', 'http://relay').pathname
    if (path !== RELAY_PATH) {
      socket.destroy()
      return
    }
    sockets.handleUpgrade(request, socket, head, (webSocket) => {
      webSocket.binaryType = 'nodebuffer'
      const connection = relay.connect({
        send: (data) => webSocket.send(data),
        close: (code, reason) => webSocket.close(code, reason)
      })
      webSocket.on('message', (data) => connection.receive(bytes(data)))
      webSocket.on('close', () => connection.closed())
      webSocket.on('error', () => webSocket.terminate())
    })
  }

  server.on('upgrade', upgrade)
  return {
    async close() {
      server.off('upgrade', upgrade)
      await relay.close()
      for (const client of sockets.clients) client.terminate()
      await new Promise<void>((resolve) => {
        sockets.close(() => resolve())
      })
    }
  }
}

/** The relay's public URL on the same origin as the API, unless the deployment names another. */
export function defaultRelayURL(publicURL: string): string {
  const url = new URL(RELAY_PATH, publicURL)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.href
}
