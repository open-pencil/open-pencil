import { RELAY_CLOSE, RELAY_DOCUMENT_PARAM } from '#cloud/contract'
import { createPostgresCloudDatabase } from '#cloud/runtime/postgres/database'
import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import {
  createCollaborationRelay,
  createCollaborationStateStore,
  createConfiguredCloudPolicy,
  readRelayPeerState,
  relayDocumentLookups,
  reportCloudError,
  type CollaborationRelay,
  type RelayConnection,
  type RelaySocket
} from '#cloud/server'
import { DurableObject } from 'cloudflare:workers'
import type { Context } from 'hono'
import * as v from 'valibot'

import type { CloudflareCloudEnvironment, PreparedCloudflareCloud } from './environment'

/** What the Worker calls on a document's relay object. */
export interface CollaborationRelayRPC extends DurableObject<CloudflareCloudEnvironment> {
  /** Ends the document's live rooms after a restore, without saving them. */
  startOver(documentId: string): Promise<void>
  /** Tells the document's live rooms its version history changed. */
  announceVersions(documentId: string): Promise<void>
}

const documentIdSchema = v.pipe(v.string(), v.uuid())

/** The document's relay object. */
export function relayFor(env: CloudflareCloudEnvironment, documentId: string) {
  return env.RELAY.get(env.RELAY.idFromName(documentId))
}

/**
 * Sends a relay socket to its document's relay object. The ticket's URL names the document; the
 * object refuses tickets for any other.
 */
export async function routeToRelay(
  c: Context<{ Bindings: CloudflareCloudEnvironment }>
): Promise<Response> {
  if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') {
    return c.text('Expected a WebSocket upgrade', 426)
  }
  const documentId = c.req.query(RELAY_DOCUMENT_PARAM)
  if (!v.is(documentIdSchema, documentId)) return c.text('Missing document', 400)
  return relayFor(c.env, documentId).fetch(c.req.raw)
}

/** A socket message's bytes; text is passed on as bytes for the relay to refuse. */
function bytes(data: unknown): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  return new TextEncoder().encode(typeof data === 'string' ? data : '')
}

/**
 * A hibernatable socket as the relay sees it. The peer's state rides on the socket as its
 * attachment, so a relay woken from hibernation can resume the peer.
 */
function relaySocket(socket: WebSocket): RelaySocket {
  // A closing socket throws on send and close, which would stop a broadcast to the others.
  const open = () => socket.readyState === WebSocket.OPEN
  return {
    send(data) {
      if (open()) socket.send(data)
    },
    close(code, reason) {
      if (open()) socket.close(code, reason)
    },
    remember(state) {
      socket.serializeAttachment(state)
    }
  }
}

/**
 * The Durable Object class holding one document's live rooms: every epoch of the document meets
 * on one relay, so a restore or a version change reaches all of them in one call. Sockets are
 * accepted for hibernation: an idle object is evicted while they stay open, each socket keeping
 * its peer, and the relay it wakes to resumes them, loading a room's document only once a message
 * needs it.
 */
export function createCloudflareRelayObject(
  prepare: (env: CloudflareCloudEnvironment) => Promise<PreparedCloudflareCloud>
) {
  return class CollaborationRelayObject
    extends DurableObject<CloudflareCloudEnvironment>
    implements CollaborationRelayRPC
  {
    #relay: Promise<CollaborationRelay> | null = null
    /** Each socket's connection to the relay, since this object last woke. */
    readonly #connections = new Map<WebSocket, RelayConnection>()

    /** The relay, created once per wake; it takes back every socket the object still holds. */
    #open(documentId: string) {
      this.#relay ??= prepare(this.env).then(({ config, reportError }) => {
        const database = createPostgresCloudDatabase({ connectionString: config.databaseURL })
        const relay = createCollaborationRelay({
          authSecret: config.authSecret,
          documentId,
          store: createCollaborationStateStore(database, createS3ObjectStore(config)),
          maximumMessageBytes: config.technicalLimits.maximumCollaborationMessageBytes,
          maximumConnectionsPerRoom: config.technicalLimits.maximumConnectionsPerRoom,
          onError: (message, error) =>
            this.ctx.waitUntil(reportCloudError(reportError, message, error, { source: 'relay' })),
          ...relayDocumentLookups(
            database,
            createConfiguredCloudPolicy(config, database),
            config.deployment
          )
        })
        for (const socket of this.ctx.getWebSockets()) {
          if (this.#connections.has(socket)) continue
          const state = readRelayPeerState(socket.deserializeAttachment())
          // A socket the relay never admitted has no peer to resume, and its ticket is long due.
          if (state) this.#connections.set(socket, relay.resume(relaySocket(socket), state))
          else socket.close(RELAY_CLOSE.unauthorized, 'Expected a collaboration ticket')
        }
        return relay
      })
      this.#relay.catch(() => {
        this.#relay = null
      })
      return this.#relay
    }

    /** The relay as woken for the document a socket's peer is in, or null for a stray socket. */
    async #relayFor(socket: WebSocket): Promise<RelayConnection | null> {
      const known = this.#connections.get(socket)
      if (known) return known
      const state = readRelayPeerState(socket.deserializeAttachment())
      if (!state) return null
      await this.#open(state.authorization.documentId)
      return this.#connections.get(socket) ?? null
    }

    /** Accepts a socket that `routeToRelay` sent here. */
    override async fetch(request: Request): Promise<Response> {
      const documentId = new URL(request.url).searchParams.get(RELAY_DOCUMENT_PARAM)
      if (!v.is(documentIdSchema, documentId)) return new Response(null, { status: 400 })
      const relay = await this.#open(documentId)
      const { 0: client, 1: server } = new WebSocketPair()
      this.ctx.acceptWebSocket(server)
      this.#connections.set(server, relay.connect(relaySocket(server)))
      return new Response(null, { status: 101, webSocket: client })
    }

    override async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
      const connection = await this.#relayFor(socket)
      if (connection) connection.receive(bytes(message))
      else socket.close(RELAY_CLOSE.unauthorized, 'Expected a collaboration ticket')
    }

    override async webSocketClose(socket: WebSocket) {
      this.#closed(socket)
    }

    override async webSocketError(socket: WebSocket) {
      this.#closed(socket)
    }

    #closed(socket: WebSocket) {
      this.#connections.get(socket)?.closed()
      this.#connections.delete(socket)
    }

    async startOver(documentId: string) {
      if (this.ctx.getWebSockets().length === 0 && !this.#relay) return
      ;(await this.#open(documentId)).startOver(documentId)
    }

    async announceVersions(documentId: string) {
      if (this.ctx.getWebSockets().length === 0 && !this.#relay) return
      ;(await this.#open(documentId)).announceVersions(documentId)
    }
  }
}
