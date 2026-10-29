import { RELAY_DOCUMENT_PARAM } from '#cloud/contract'
import { createPostgresCloudDatabase } from '#cloud/runtime/postgres/database'
import {
  createCollaborationRelay,
  createCollaborationStateStore,
  createConfiguredCloudPolicy,
  relayDocumentLookups,
  type CollaborationRelay,
  type RelayConnection
} from '#cloud/server'
import { DurableObject } from 'cloudflare:workers'
import type { Context } from 'hono'
import * as v from 'valibot'

import type { CloudflareCloudEnvironment, PreparedCloudflareCloud } from './environment'

/** What the Worker calls on a document's relay object. */
export interface CollaborationRelayRPC extends DurableObject<CloudflareCloudEnvironment> {
  /** Ends the document's live rooms after a restore, without saving them. */
  startOver(documentId: string): void
  /** Tells the document's live rooms its version history changed. */
  announceVersions(documentId: string): void
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
export function routeToRelay(c: Context<{ Bindings: CloudflareCloudEnvironment }>) {
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

/** Hands a WebSocket the object accepted to the relay, as the Node runtime does with `ws`. */
function accept(relay: CollaborationRelay): Response {
  const { 0: client, 1: server } = new WebSocketPair()
  // Standard sockets deliver binary messages as Blobs unless asked otherwise.
  server.binaryType = 'arraybuffer'
  server.accept()
  let connection: RelayConnection | null = null
  const closed = () => {
    connection?.closed()
    connection = null
  }
  // A closing socket throws on send and close, which would stop a broadcast to the others.
  const open = () => server.readyState === WebSocket.OPEN
  connection = relay.connect({
    send(data) {
      if (open()) server.send(data)
    },
    close(code, reason) {
      if (open()) server.close(code, reason)
    }
  })
  server.addEventListener('message', ({ data }: { data: unknown }) =>
    connection?.receive(bytes(data))
  )
  server.addEventListener('close', closed)
  server.addEventListener('error', closed)
  return new Response(null, { status: 101, webSocket: client })
}

/**
 * The Durable Object class holding one document's live rooms: every epoch of the document meets
 * on one relay, so a restore or a version change reaches all of them in one call. Sockets stay
 * open without hibernation, so the rooms' documents and timers live in memory as on Node.
 */
export function createCloudflareRelayObject(
  prepare: (env: CloudflareCloudEnvironment) => Promise<PreparedCloudflareCloud>
) {
  return class CollaborationRelayObject
    extends DurableObject<CloudflareCloudEnvironment>
    implements CollaborationRelayRPC
  {
    #relay: Promise<CollaborationRelay> | null = null
    /** Set by the first socket; restores and version changes before it have no rooms to reach. */
    #opened: CollaborationRelay | null = null

    #open(documentId: string) {
      this.#relay ??= prepare(this.env).then(({ config }) => {
        const database = createPostgresCloudDatabase({ connectionString: config.databaseURL })
        this.#opened = createCollaborationRelay({
          authSecret: config.authSecret,
          documentId,
          store: createCollaborationStateStore(database),
          maximumMessageBytes: config.technicalLimits.maximumCollaborationMessageBytes,
          maximumConnectionsPerRoom: config.technicalLimits.maximumConnectionsPerRoom,
          ...relayDocumentLookups(
            database,
            createConfiguredCloudPolicy(config, database),
            config.deployment
          )
        })
        return this.#opened
      })
      this.#relay.catch(() => {
        this.#relay = null
      })
      return this.#relay
    }

    /** Accepts a socket that `routeToRelay` sent here. */
    override async fetch(request: Request): Promise<Response> {
      const documentId = new URL(request.url).searchParams.get(RELAY_DOCUMENT_PARAM)
      if (!v.is(documentIdSchema, documentId)) return new Response(null, { status: 400 })
      return accept(await this.#open(documentId))
    }

    startOver(documentId: string) {
      this.#opened?.startOver(documentId)
    }

    announceVersions(documentId: string) {
      this.#opened?.announceVersions(documentId)
    }
  }
}
