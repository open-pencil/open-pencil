import {
  createRelayServerAssembler,
  decodeRelayServerFrame,
  decodeRoomUpdate,
  encodeRelayClientFrame,
  MAX_COLLAB_MESSAGE_BYTES,
  relayClientMessages,
  type CollaborationPrincipal,
  type DocumentPermission,
  type RelayClientFrame,
  type RelayServerFrame
} from '#cloud/contract'
import {
  createCollaborationRelay,
  type CollaborationRelay,
  type CollaborationRelayOptions,
  type CollaborationRoomIdentity,
  type CollaborationStateStore,
  type RelayConnection,
  type RelaySocket
} from '#cloud/server'
import { SignJWT } from 'jose'
import * as Y from 'yjs'

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
  /** Sends the frame in one message, as a peer that never splits frames would. */
  send(frame: RelayClientFrame): void
  /** Sends the frame as the editor does: in fragments once it is large. */
  sendFragmented(frame: RelayClientFrame): void
  /** How many socket messages the relay sent. */
  received: number
  /** The peer ID from the relay's welcome. */
  peerId(): string | undefined
  messages(namespace: string): Extract<RelayServerFrame, { type: 'message' }>[]
}

export function connectTestClient(connect: (socket: RelaySocket) => RelayConnection) {
  const client: Omit<TestRelayClient, 'connection'> = {
    frames: [],
    closed: null,
    received: 0,
    send(frame) {
      connection.receive(encodeRelayClientFrame(frame))
    },
    sendFragmented(frame) {
      for (const message of relayClientMessages(frame)) connection.receive(message)
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
  const assembler = createRelayServerAssembler(() => MAX_COLLAB_MESSAGE_BYTES)
  const connection = connect({
    send(data) {
      client.received++
      const assembled = assembler.push(data)
      const frame = assembled.type === 'frame' ? decodeRelayServerFrame(assembled.data) : null
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

/** A relay over an in-memory store that saves at once, with whatever a test changes. */
export function startTestRelay(options: Partial<CollaborationRelayOptions> = {}) {
  const state = memoryStateStore()
  const instance = createCollaborationRelay({
    authSecret: relaySecret,
    store: state.store,
    maximumMessageBytes: 1_048_576,
    maximumConnectionsPerRoom: 100,
    persistDelayMs: 0,
    onError: () => undefined,
    ...options
  })
  return { relay: instance, ...state }
}

/** A peer in the room of `documentId`, an editor unless the ticket says otherwise. */
export async function joinTestRelay(
  hub: CollaborationRelay,
  documentId: string,
  ticket: Partial<RelayTicketOptions> = {}
) {
  const client = connectTestClient((socket) => hub.connect(socket))
  client.send({
    type: 'auth',
    token: await relayTicket({
      documentId,
      permission: 'edit',
      principal: user(crypto.randomUUID()),
      ...ticket
    })
  })
  await until(() => client.peerId() !== undefined || client.closed !== null)
  return client
}

/** A V2 update that writes `text` into a document's `t` text. */
export function textUpdate(text: string) {
  const document = new Y.Doc()
  document.getText('t').insert(0, text)
  return Y.encodeStateAsUpdateV2(document)
}

/** The text a sync reply carries, which travels as a compressed V2 update. */
export function textOfSyncReply(reply: Uint8Array) {
  const document = new Y.Doc()
  const update = decodeRoomUpdate(reply, { limit: MAX_COLLAB_MESSAGE_BYTES, compressed: true })
  if (update) Y.applyUpdateV2(document, update)
  return document.getText('t').toString()
}
