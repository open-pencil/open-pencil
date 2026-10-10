import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { connectTestClient, until } from '#cloud-tests/helpers/relay'
import { COLLAB_ACTIONS, RELAY_SERVER_PEER } from '#cloud/contract'
import {
  createCollaborationRelay,
  createCollaborationStateStore,
  createCollaborationTicketService,
  createDocumentSharingService
} from '#cloud/server'
import * as Y from 'yjs'

const authSecret = 'collaboration-test-secret-at-least-32-characters'
const relayURL = 'wss://cloud.example.com/api/collaboration/relay'

async function seed() {
  const runtime = await createCloudTestDatabase()
  const workspaceId = crypto.randomUUID()
  const documentId = crypto.randomUUID()
  await runtime.database
    .insertInto('workspace')
    .values({ id: workspaceId, name: 'Design', slug: `design-${workspaceId}`, createdBy: 'owner' })
    .execute()
  await runtime.database
    .insertInto('workspaceMember')
    .values([
      { workspaceId, userId: 'owner', role: 'admin' },
      { workspaceId, userId: 'viewer', role: 'viewer' }
    ])
    .execute()
  await runtime.database
    .insertInto('document')
    .values({ id: documentId, workspaceId, name: 'Homepage', createdBy: 'owner' })
    .execute()
  const tickets = createCollaborationTicketService({
    database: runtime.database,
    sharing: createDocumentSharingService(runtime.database),
    authSecret,
    relayURL
  })
  const store = createCollaborationStateStore(runtime.database)
  const relay = () =>
    createCollaborationRelay({
      authSecret,
      store,
      maximumMessageBytes: 1_048_576,
      maximumConnectionsPerRoom: 100,
      persistDelayMs: 0
    })
  return { runtime, documentId, tickets, store, relay }
}

describe('collaboration relay with issued tickets', () => {
  test('admits ticket holders and keeps the room in PostgreSQL across relay restarts', async () => {
    const context = await seed()
    try {
      const owner = { userId: 'owner', name: 'Owner', email: 'owner@example.com' }
      const ticket = await context.tickets.issueUserTicket(owner, context.documentId)
      expect(ticket).toMatchObject({
        provider: 'relay',
        serverURL: relayURL,
        serverEnforcedWrites: true
      })

      const first = context.relay()
      const editor = connectTestClient((socket) => first.connect(socket))
      editor.send({ type: 'auth', token: ticket.token })
      await until(() => editor.peerId() !== undefined)
      const document = new Y.Doc()
      document.getText('t').insert(0, 'saved')
      editor.send({
        type: 'message',
        namespace: COLLAB_ACTIONS.yjsUpdate,
        target: null,
        payload: Y.encodeStateAsUpdate(document)
      })
      editor.connection.closed()
      await first.close()

      const stored = await context.store.load({ documentId: context.documentId, roomEpoch: 0 })
      expect(stored).not.toBeNull()

      const second = context.relay()
      const viewerTicket = await context.tickets.issueUserTicket(
        { userId: 'viewer', name: 'Viewer', email: 'viewer@example.com' },
        context.documentId
      )
      const viewer = connectTestClient((socket) => second.connect(socket))
      viewer.send({ type: 'auth', token: viewerTicket.token })
      await until(() => viewer.peerId() !== undefined)
      viewer.send({
        type: 'message',
        namespace: COLLAB_ACTIONS.syncStep1,
        target: RELAY_SERVER_PEER,
        payload: Y.encodeStateVector(new Y.Doc())
      })
      await until(() => viewer.messages(COLLAB_ACTIONS.syncReply).length > 0)
      const restored = new Y.Doc()
      Y.applyUpdate(
        restored,
        viewer.messages(COLLAB_ACTIONS.syncReply)[0]?.payload ?? new Uint8Array()
      )
      expect(restored.getText('t').toString()).toBe('saved')
      await second.close()
    } finally {
      await context.runtime.close()
    }
  })

  test('issues peer-to-peer tickets the relay refuses when no relay is configured', async () => {
    const context = await seed()
    try {
      const tickets = createCollaborationTicketService({
        database: context.runtime.database,
        sharing: createDocumentSharingService(context.runtime.database),
        authSecret
      })
      const ticket = await tickets.issueUserTicket(
        { userId: 'owner', name: 'Owner', email: 'owner@example.com' },
        context.documentId
      )
      expect(ticket).toMatchObject({ provider: 'trystero', serverEnforcedWrites: false })
      const relay = context.relay()
      const client = connectTestClient((socket) => relay.connect(socket))
      client.send({ type: 'auth', token: ticket.token })
      await until(() => client.closed !== null)
      expect(client.closed?.code).toBe(4401)
    } finally {
      await context.runtime.close()
    }
  })
})
