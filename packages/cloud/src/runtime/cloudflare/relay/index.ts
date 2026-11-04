import { RELAY_DOCUMENT_PARAM } from '#cloud/contract'
import { createPostgresCloudDatabase } from '#cloud/runtime/postgres/database'
import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import {
  createCollaborationRelay,
  createCollaborationStateStore,
  createConfiguredCloudPolicy,
  relayDocumentLookups,
  reportCloudError,
  type CollaborationRelay
} from '#cloud/server'
import { DurableObject } from 'cloudflare:workers'
import type { Context } from 'hono'
import * as v from 'valibot'

import type { CloudflareCloudEnvironment, PreparedCloudflareCloud } from '../environment'
import { createRelaySockets } from './sockets'

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

/** The relay over the deployment's PostgreSQL and object store. */
function configuredRelay(
  { config }: PreparedCloudflareCloud,
  documentId: string,
  onError: (message: string, error: unknown) => void
): CollaborationRelay {
  const database = createPostgresCloudDatabase({ connectionString: config.databaseURL })
  return createCollaborationRelay({
    authSecret: config.authSecret,
    documentId,
    store: createCollaborationStateStore(database, createS3ObjectStore(config)),
    maximumMessageBytes: config.technicalLimits.maximumCollaborationMessageBytes,
    maximumConnectionsPerRoom: config.technicalLimits.maximumConnectionsPerRoom,
    onError,
    ...relayDocumentLookups(
      database,
      createConfiguredCloudPolicy(config, database),
      config.deployment
    )
  })
}

/**
 * The Durable Object class holding one document's live rooms: every epoch of the document meets
 * on one relay, so a restore or a version change reaches all of them in one call. Its sockets
 * hibernate with it (see `createRelaySockets`).
 */
export function createCloudflareRelayObject(
  prepare: (env: CloudflareCloudEnvironment) => Promise<PreparedCloudflareCloud>
) {
  return class CollaborationRelayObject
    extends DurableObject<CloudflareCloudEnvironment>
    implements CollaborationRelayRPC
  {
    readonly #sockets = createRelaySockets({
      sockets: () => this.ctx.getWebSockets(),
      createRelay: async (documentId) => {
        const prepared = await prepare(this.env)
        return configuredRelay(prepared, documentId, (message, error) =>
          this.ctx.waitUntil(
            reportCloudError(prepared.reportError, message, error, { source: 'relay' })
          )
        )
      }
    })

    /** Accepts a socket that `routeToRelay` sent here. */
    override async fetch(request: Request): Promise<Response> {
      const documentId = new URL(request.url).searchParams.get(RELAY_DOCUMENT_PARAM)
      if (!v.is(documentIdSchema, documentId)) return new Response(null, { status: 400 })
      const relay = await this.#sockets.open(documentId)
      const { 0: client, 1: server } = new WebSocketPair()
      this.ctx.acceptWebSocket(server)
      this.#sockets.accept(server, relay)
      return new Response(null, { status: 101, webSocket: client })
    }

    override async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
      await this.#sockets.message(socket, message)
    }

    override async webSocketClose(socket: WebSocket) {
      await this.#sockets.closed(socket)
    }

    override async webSocketError(socket: WebSocket) {
      await this.#sockets.closed(socket)
    }

    async startOver(documentId: string) {
      if (!this.#sockets.active) return
      ;(await this.#sockets.open(documentId)).startOver(documentId)
    }

    async announceVersions(documentId: string) {
      if (!this.#sockets.active) return
      ;(await this.#sockets.open(documentId)).announceVersions(documentId)
    }
  }
}
