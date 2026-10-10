import { createServer } from 'node:http'

import { RELAY_PATH, type DocumentPermission } from '@open-pencil/cloud/contract'
import { attachCollaborationRelay } from '@open-pencil/cloud/runtime/node'
import {
  createCollaborationRelay,
  signCollaborationTicket,
  type CollaborationStateStore
} from '@open-pencil/cloud/server'

import { createCloudRelayJoin } from '@/app/collab/transport/cloud'

const AUTH_SECRET = 'relay-integration-secret-at-least-32-characters'

/** A Cloud relay on a loopback port, keeping room state in memory; `close` stops it. */
export async function startTestRelay() {
  const states = new Map<string, Uint8Array>()
  const store: CollaborationStateStore = {
    load: async (room) => states.get(`${room.documentId}:${room.roomEpoch}`) ?? null,
    store: async (room, state) => {
      states.set(`${room.documentId}:${room.roomEpoch}`, state)
    }
  }
  const relay = createCollaborationRelay({
    authSecret: AUTH_SECRET,
    store,
    maximumMessageBytes: 1_048_576,
    maximumConnectionsPerRoom: 10,
    persistDelayMs: 0
  })
  const server = createServer()
  const attached = attachCollaborationRelay(server, relay, 1_048_576)
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected a TCP address')
  const url = `ws://127.0.0.1:${address.port}${RELAY_PATH}`
  return {
    url,
    states,
    /** Joins a document's room as a guest with the given permission. */
    join(documentId: string, name: string, permission: DocumentPermission) {
      return createCloudRelayJoin({
        url,
        ticket: async () =>
          signCollaborationTicket({
            authSecret: AUTH_SECRET,
            documentId,
            principal: { kind: 'guest', guestId: crypto.randomUUID(), name },
            permission,
            roomEpoch: 0,
            relayURL: url
          })
      })
    },
    async close() {
      await attached.close()
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
    }
  }
}
