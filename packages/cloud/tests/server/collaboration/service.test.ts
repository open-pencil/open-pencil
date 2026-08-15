import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'
import { decodeJwt } from 'jose'

import {
  createCollaborationTicketService,
  createDocumentSharingService
} from '@open-pencil/cloud/server'

const authSecret = 'collaboration-test-secret-at-least-32-characters'

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
  const sharing = createDocumentSharingService(runtime.database)
  return {
    runtime,
    documentId,
    sharing,
    tickets: createCollaborationTicketService(runtime.database, sharing, authSecret)
  }
}

describe('collaboration tickets', () => {
  test('issues signed tickets from authenticated document permissions', async () => {
    const context = await seed()
    try {
      const ticket = await context.tickets.issueUserTicket(
        { userId: 'viewer', name: 'Viewer', email: 'viewer@example.com' },
        context.documentId
      )
      expect(ticket).toMatchObject({
        documentId: context.documentId,
        permission: 'view',
        roomEpoch: 0,
        serverEnforcedWrites: false,
        principal: { kind: 'user', userId: 'viewer' }
      })
      expect(ticket.roomId).toBe(`cloud:${context.documentId}:0`)
      expect(ticket.roomKey.length).toBeGreaterThanOrEqual(43)
      expect(decodeJwt(ticket.token)).toMatchObject({
        documentId: context.documentId,
        permission: 'view',
        serverEnforcedWrites: false
      })
    } finally {
      await context.runtime.close()
    }
  })

  test('binds guest tickets to capability permissions and rotated room epochs', async () => {
    const context = await seed()
    try {
      const capability = await context.sharing.createShare('owner', context.documentId, {
        permission: 'edit'
      })
      await context.runtime.database
        .updateTable('document')
        .set({ collaborationEpoch: capability.share.roomEpoch })
        .where('id', '=', context.documentId)
        .execute()
      const rotated = await context.sharing.rotateShare(
        'owner',
        context.documentId,
        capability.share.id
      )
      const ticket = await context.tickets.issueShareTicket(capability.share.id, {
        secret: rotated.secret,
        guestName: 'Guest editor',
        guestId: 'stable-guest-identity'
      })
      expect(ticket).toMatchObject({
        permission: 'edit',
        roomEpoch: 1,
        roomId: `cloud:${context.documentId}:1`,
        principal: {
          kind: 'guest',
          guestId: 'stable-guest-identity',
          name: 'Guest editor'
        },
        serverEnforcedWrites: false
      })
      const ownerTicket = await context.tickets.issueUserTicket(
        { userId: 'owner', name: 'Owner', email: 'owner@example.com' },
        context.documentId
      )
      expect(ownerTicket).toMatchObject({
        roomEpoch: 1,
        roomId: `cloud:${context.documentId}:1`,
        principal: { kind: 'user', userId: 'owner' }
      })
      const secondCapability = await context.sharing.createShare('owner', context.documentId, {
        permission: 'view'
      })
      expect(secondCapability.share.roomEpoch).toBe(1)
      const secondTicket = await context.tickets.issueShareTicket(secondCapability.share.id, {
        secret: secondCapability.secret,
        guestName: 'Guest viewer',
        guestId: 'stable-guest-viewer'
      })
      expect(secondTicket).toMatchObject({ roomEpoch: 1, roomId: `cloud:${context.documentId}:1` })
      await context.sharing.revokeShare('owner', context.documentId, secondCapability.share.id)
      const afterRevocation = await context.tickets.issueUserTicket(
        { userId: 'owner', name: 'Owner', email: 'owner@example.com' },
        context.documentId
      )
      expect(afterRevocation).toMatchObject({
        roomEpoch: 2,
        roomId: `cloud:${context.documentId}:2`
      })
    } finally {
      await context.runtime.close()
    }
  })
})
