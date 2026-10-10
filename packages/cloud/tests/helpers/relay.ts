import {
  decodeRelayServerFrame,
  encodeRelayClientFrame,
  type CollaborationPrincipal,
  type DocumentPermission,
  type RelayClientFrame,
  type RelayServerFrame
} from '#cloud/contract'
import type {
  CollaborationRoomIdentity,
  CollaborationStateStore,
  RelayConnection,
  RelaySocket
} from '#cloud/server'
import { SignJWT } from 'jose'

export const relaySecret = 'relay-test-secret-at-least-32-characters'

export type RelayTicketOptions = {
  documentId: string
  permission: DocumentPermission
  principal: CollaborationPrincipal
  roomEpoch?: number
  roomId?: string
  expiresInSeconds?: number
}

export async function relayTicket(options: RelayTicketOptions): Promise<string> {
  const roomEpoch = options.roomEpoch ?? 0
  const issuedAt = Math.floor(Date.now() / 1000)
  return new SignJWT({
    documentId: options.documentId,
    roomId: options.roomId ?? `cloud:${options.documentId}:${roomEpoch}`,
    principal: options.principal,
    permission: options.permission,
    roomEpoch,
    serverEnforcedWrites: true
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + (options.expiresInSeconds ?? 300))
    .sign(new TextEncoder().encode(relaySecret))
}

export function user(userId: string, name = userId): CollaborationPrincipal {
  return { kind: 'user', userId, name, email: `${userId}@example.com` }
}

export function guest(guestId: string, name = guestId): CollaborationPrincipal {
  return { kind: 'guest', guestId, name }
}

/** An in-memory socket that records what the relay sends and how it closed. */
export type TestRelayClient = {
  frames: RelayServerFrame[]
  closed: { code: number; reason: string } | null
  connection: RelayConnection
  send(frame: RelayClientFrame): void
  /** The peer ID from the relay's welcome. */
  peerId(): string | undefined
  messages(namespace: string): Extract<RelayServerFrame, { type: 'message' }>[]
}

export function connectTestClient(connect: (socket: RelaySocket) => RelayConnection) {
  const client: Omit<TestRelayClient, 'connection'> = {
    frames: [],
    closed: null,
    send(frame) {
      connection.receive(encodeRelayClientFrame(frame))
    },
    peerId() {
      const welcome = client.frames.find((frame) => frame.type === 'welcome')
      return welcome?.type === 'welcome' ? welcome.peerId : undefined
    },
    messages(namespace) {
      return client.frames.flatMap((frame) =>
        frame.type === 'message' && frame.namespace === namespace ? [frame] : []
      )
    }
  }
  const connection = connect({
    send(data) {
      const frame = decodeRelayServerFrame(data)
      if (frame) client.frames.push(frame)
    },
    close(code, reason) {
      if (client.closed) return
      client.closed = { code, reason }
      connection.closed()
    }
  })
  return Object.assign(client, { connection })
}

/** Resolves once `condition` holds, yielding to pending work between checks. */
export async function until(condition: () => boolean, attempts = 200): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (condition()) return
    await new Promise((resolve) => {
      setTimeout(resolve, 1)
    })
  }
  throw new Error('Condition was not met')
}

export function memoryStateStore() {
  const states = new Map<string, Uint8Array>()
  const key = (room: CollaborationRoomIdentity) => `${room.documentId}:${room.roomEpoch}`
  const store: CollaborationStateStore = {
    async load(room) {
      return states.get(key(room)) ?? null
    },
    async store(room, state) {
      states.set(key(room), state)
    }
  }
  return { store, states }
}
