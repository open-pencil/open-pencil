import {
  AGENT_PAIRING_PARAM,
  agentPairingIdSchema,
  MAX_COLLAB_MESSAGE_BYTES,
  RELAY_DOCUMENT_PARAM,
  RELAY_HEARTBEAT,
  type AgentToolCall,
  type AgentToolOutcome
} from '#cloud/contract'
import { createPostgresCloudDatabase } from '#cloud/runtime/postgres/database'
import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import {
  createAgentPairingHub,
  createCollaborationRelay,
  createCollaborationStateStore,
  createConfiguredCloudPolicy,
  relayDocumentLookups,
  reportCloudError,
  type CollaborationRelay,
  type CollaborationRelayOptions
} from '#cloud/server'
import { DurableObject } from 'cloudflare:workers'
import type { Context } from 'hono'
import * as v from 'valibot'

import type { CloudflareCloudEnvironment, PreparedCloudflareCloud } from '../environment'
import { inMaintenance, MAINTENANCE_CLOSE_CODE, maintenanceResponse } from '../maintenance'
import { createPairingSockets, PAIRING_SOCKET_TAG } from './pairing'
import { createRelaySockets } from './sockets'

/** What the Worker calls on a document's relay object. */
export interface CollaborationRelayRPC extends DurableObject<CloudflareCloudEnvironment> {
  /** Ends the document's live rooms after a restore, without saving them. */
  startOver(documentId: string): Promise<void>
  /** Ends a taken-down document's live rooms, saving them. */
  closeDocument(documentId: string): Promise<void>
  /** Tells the document's live rooms its version history changed. */
  announceVersions(documentId: string): Promise<void>
  /** Tells the document's live rooms one of its comment threads changed. */
  announceComments(documentId: string, threadId: string): Promise<void>
  /** Runs an app's design tool through an editor of the person that has the document open. */
  callTool(documentId: string, userId: string, call: AgentToolCall): Promise<AgentToolOutcome>
  /** Runs an agent's design tool in the editor tab of the pairing this object serves. */
  callPairedTool(pairing: string, call: AgentToolCall): Promise<AgentToolOutcome>
}

/** The Durable Object class a Worker exports for collaboration rooms. */
export type CollaborationRelayObjectClass = new (
  ctx: DurableObjectState,
  env: CloudflareCloudEnvironment
) => CollaborationRelayRPC

const documentIdSchema = v.pipe(v.string(), v.uuid())

/**
 * The most a room's document may hold on Cloudflare. A Durable Object has 128 MB of memory for
 * the document, the update joining it, and the snapshot written from it, so a room past this is
 * turned away and its editors save without one.
 */
export const CLOUDFLARE_MAXIMUM_ROOM_BYTES = 32 * 1024 * 1024

/**
 * The document's relay object. With a jurisdiction, objects are created and keep their storage
 * only inside it; an object named outside one is a different object, so a deployment never
 * changes its jurisdiction while rooms are live.
 */
export function relayFor(
  env: CloudflareCloudEnvironment,
  documentId: string,
  jurisdiction?: DurableObjectJurisdiction
) {
  const namespace = jurisdiction ? env.RELAY.jurisdiction(jurisdiction) : env.RELAY
  return namespace.get(namespace.idFromName(documentId))
}

/**
 * Sends a relay socket to its document's relay object. The ticket's URL names the document; the
 * object refuses tickets for any other.
 */
export function relayRoute(jurisdiction?: DurableObjectJurisdiction) {
  return async (c: Context<{ Bindings: CloudflareCloudEnvironment }>): Promise<Response> => {
    if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') {
      return c.text('Expected a WebSocket upgrade', 426)
    }
    const documentId = c.req.query(RELAY_DOCUMENT_PARAM)
    if (!v.is(documentIdSchema, documentId)) return c.text('Missing document', 400)
    return relayFor(c.env, documentId, jurisdiction).fetch(c.req.raw)
  }
}

/** The object of the editor tab paired with an agent, whose pairing ID names it. */
export function pairingFor(
  env: CloudflareCloudEnvironment,
  pairing: string,
  jurisdiction?: DurableObjectJurisdiction
) {
  return relayFor(env, `pairing:${pairing}`, jurisdiction)
}

/**
 * Sends a paired tab's socket to its pairing's object, where the deployment pairs tabs; the
 * address names the pairing, and the object refuses a token for any other.
 */
export function pairingRoute(
  paired: (env: CloudflareCloudEnvironment) => Promise<boolean>,
  jurisdiction?: DurableObjectJurisdiction
) {
  return async (c: Context<{ Bindings: CloudflareCloudEnvironment }>): Promise<Response> => {
    if (!(await paired(c.env))) return c.notFound()
    if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') {
      return c.text('Expected a WebSocket upgrade', 426)
    }
    const pairing = c.req.query(AGENT_PAIRING_PARAM)
    if (!v.is(agentPairingIdSchema, pairing)) return c.text('Missing pairing', 400)
    return pairingFor(c.env, pairing, jurisdiction).fetch(c.req.raw)
  }
}

/** The relay over the deployment's PostgreSQL and object store. */
function configuredRelay(
  { config }: PreparedCloudflareCloud,
  documentId: string,
  onError: NonNullable<CollaborationRelayOptions['onError']>
): CollaborationRelay {
  // Hyperdrive keeps no session settings and ends queries past its own limit.
  const database = createPostgresCloudDatabase({
    connectionString: config.databaseURL,
    statementTimeoutMs: null
  })
  return createCollaborationRelay({
    authSecret: config.authSecret,
    documentId,
    store: createCollaborationStateStore(database, createS3ObjectStore(config)),
    maximumMessageBytes: config.technicalLimits.maximumCollaborationMessageBytes,
    maximumRoomBytes: CLOUDFLARE_MAXIMUM_ROOM_BYTES,
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
): CollaborationRelayObjectClass {
  return class CollaborationRelayObject
    extends DurableObject<CloudflareCloudEnvironment>
    implements CollaborationRelayRPC
  {
    constructor(ctx: DurableObjectState, env: CloudflareCloudEnvironment) {
      super(ctx, env)
      // Peers check the relay still hears them; the runtime answers without waking the object.
      ctx.setWebSocketAutoResponse(
        new WebSocketRequestResponsePair(RELAY_HEARTBEAT.ping, RELAY_HEARTBEAT.pong)
      )
    }

    readonly #sockets = createRelaySockets({
      sockets: () => this.ctx.getWebSockets(),
      createRelay: async (documentId) => {
        const prepared = await prepare(this.env)
        return configuredRelay(
          prepared,
          documentId,
          (message, error, { userId, ...resources } = {}) =>
            this.ctx.waitUntil(
              reportCloudError(prepared.reportError, message, error, {
                source: 'relay',
                resources,
                ...(userId && { userId })
              })
            )
        )
      }
    })

    readonly #pairing = createPairingSockets({
      sockets: () => this.ctx.getWebSockets(PAIRING_SOCKET_TAG),
      createHub: async (pairing) => {
        const { config } = await prepare(this.env)
        return createAgentPairingHub({
          pairing,
          maximumMessageBytes: config.technicalLimits.maximumCollaborationMessageBytes,
          maximumAnswerBytes: Math.min(CLOUDFLARE_MAXIMUM_ROOM_BYTES, MAX_COLLAB_MESSAGE_BYTES)
        })
      }
    })

    /** Whether a socket is a paired tab's rather than a collaboration peer's. */
    #paired(socket: WebSocket): boolean {
      return this.ctx.getTags(socket).includes(PAIRING_SOCKET_TAG)
    }

    /** Accepts a socket that `relayRoute` or `pairingRoute` sent here. */
    override async fetch(request: Request): Promise<Response> {
      if (inMaintenance(this.env)) return maintenanceResponse(request)
      const pairing = new URL(request.url).searchParams.get(AGENT_PAIRING_PARAM)
      if (pairing !== null) {
        if (!v.is(agentPairingIdSchema, pairing)) return new Response(null, { status: 400 })
        const hub = await this.#pairing.open(pairing)
        const { 0: tab, 1: socket } = new WebSocketPair()
        this.ctx.acceptWebSocket(socket, [PAIRING_SOCKET_TAG])
        this.#pairing.accept(socket, hub)
        return new Response(null, { status: 101, webSocket: tab })
      }
      const documentId = new URL(request.url).searchParams.get(RELAY_DOCUMENT_PARAM)
      if (!v.is(documentIdSchema, documentId)) return new Response(null, { status: 400 })
      const relay = await this.#sockets.open(documentId)
      const { 0: client, 1: server } = new WebSocketPair()
      this.ctx.acceptWebSocket(server)
      this.#sockets.accept(server, relay)
      return new Response(null, { status: 101, webSocket: client })
    }

    override async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
      // A socket from before maintenance began reaches the room no more: its editor reconnects
      // once maintenance ends, and nothing it sends meanwhile is written.
      if (inMaintenance(this.env)) {
        socket.close(MAINTENANCE_CLOSE_CODE, 'Down for maintenance')
        return
      }
      if (this.#paired(socket)) await this.#pairing.message(socket, message)
      else await this.#sockets.message(socket, message)
    }

    // Under maintenance a closing socket leaves its room as it is: closing the room would save
    // its state into a database that may be mid-restore.
    override async webSocketClose(socket: WebSocket) {
      if (this.#paired(socket)) await this.#pairing.closed(socket)
      else if (!inMaintenance(this.env)) await this.#sockets.closed(socket)
    }

    override async webSocketError(socket: WebSocket) {
      if (this.#paired(socket)) await this.#pairing.closed(socket)
      else if (!inMaintenance(this.env)) await this.#sockets.closed(socket)
    }

    async callPairedTool(pairing: string, call: AgentToolCall): Promise<AgentToolOutcome> {
      // No tab is connected, so none can run it.
      if (!this.#pairing.connected) return { ok: false, failure: 'editor_not_open' }
      return (await this.#pairing.open(pairing)).call(pairing, call)
    }

    async startOver(documentId: string) {
      if (!this.#sockets.active) return
      ;(await this.#sockets.open(documentId)).startOver(documentId)
    }

    async closeDocument(documentId: string) {
      if (!this.#sockets.active) return
      ;(await this.#sockets.open(documentId)).closeDocument(documentId)
    }

    async announceVersions(documentId: string) {
      if (!this.#sockets.active) return
      ;(await this.#sockets.open(documentId)).announceVersions(documentId)
    }

    async announceComments(documentId: string, threadId: string) {
      if (!this.#sockets.active) return
      ;(await this.#sockets.open(documentId)).announceComments(documentId, threadId)
    }

    async callTool(
      documentId: string,
      userId: string,
      call: AgentToolCall
    ): Promise<AgentToolOutcome> {
      // Nobody is connected, so no editor has the document open.
      if (!this.#sockets.active) return { ok: false, failure: 'editor_not_open' }
      return (await this.#sockets.open(documentId)).callTool(documentId, userId, call)
    }
  }
}
