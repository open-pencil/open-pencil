import { describe, expect, test } from 'bun:test'

import { assignOwnerUser, seedSharing } from '#cloud-test/helpers/sharing'

import {
  createDocumentSharingService,
  createInvitationOutbox,
  createTransactionalEmailService,
  DocumentShareInvalidError
} from '@open-pencil/cloud/server'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'

describe('document sharing invitations integration', () => {
  test('manages pending invitations', async () => {
    const context = await seedSharing()
    try {
      const created = await context.sharing.createInvitation('owner', context.documentId, {
        email: 'person@example.com',
        permission: 'edit'
      })
      expect(created.token).toHaveLength(32)
      expect(created.invitation).toMatchObject({
        email: 'person@example.com',
        permission: 'edit'
      })
      expect(await context.sharing.listInvitations('owner', context.documentId)).toHaveLength(1)
      const pending = await context.sharing.createInvitation('owner', context.documentId, {
        email: 'pending@example.com',
        permission: 'view'
      })
      await context.sharing.revokeInvitation('owner', context.documentId, pending.invitation.id)
      expect(await context.sharing.listInvitations('owner', context.documentId)).toHaveLength(1)
    } finally {
      await context.runtime.close()
    }
  })

  test('delivers fragment-protected invitation URLs without storing raw tokens', async () => {
    const context = await seedSharing()
    const delivered: Array<{
      recipientEmail: string
      inviterName: string
      documentName: string
      acceptanceURL: string
    }> = []
    try {
      await assignOwnerUser(context, {
        id: OWNER_ID,
        name: 'Owner Name',
        email: 'owner@example.com'
      })
      const sharing = createDocumentSharingService(context.runtime.database, {
        publicURL: 'https://cloud.example.com',
        appURL: 'https://app.example.com',
        delivery: {
          async sendDocumentInvitation(message) {
            delivered.push(message)
          }
        }
      })
      const created = await sharing.createInvitation(OWNER_ID, context.documentId, {
        email: 'person@example.com',
        permission: 'edit'
      })
      expect(delivered).toHaveLength(1)
      expect(delivered[0]).toMatchObject({
        recipientEmail: 'person@example.com',
        inviterName: 'Owner Name',
        documentName: 'Homepage'
      })
      const deliveryURL = new URL(delivered[0]?.acceptanceURL ?? '')
      expect(
        await sharing.previewInvitation(created.invitation.id, { token: created.token })
      ).toEqual({
        documentName: 'Homepage',
        inviterName: 'Owner Name',
        permission: 'edit',
        expiresAt: created.invitation.expiresAt,
        recipientHint: 'pe****@example.com'
      })
      expect(deliveryURL.origin).toBe('https://app.example.com')
      expect(deliveryURL.pathname).toBe(`/cloud/invitations/${created.invitation.id}`)
      expect(deliveryURL.searchParams.get('server')).toBe('https://cloud.example.com')
      expect(deliveryURL.hash).toBe(`#${created.token}`)
      const stored = await context.runtime.database
        .selectFrom('documentInvitation')
        .select('tokenHash')
        .where('id', '=', created.invitation.id)
        .executeTakeFirstOrThrow()
      expect(stored.tokenHash).not.toContain(created.token)
    } finally {
      await context.runtime.close()
    }
  })

  test('stores invitation and encrypted outbox message atomically', async () => {
    const context = await seedSharing()
    try {
      await assignOwnerUser(context, {
        id: OWNER_ID,
        name: 'Owner Name',
        email: 'owner-outbox@example.com'
      })
      const email = createTransactionalEmailService(context.runtime.database, {
        encryptionSecret: 'outbox-test-secret-at-least-32-characters',
        from: 'OpenPencil <cloud@example.com>'
      })
      const sharing = createDocumentSharingService(context.runtime.database, {
        publicURL: 'https://cloud.example.com',
        appURL: 'https://app.example.com',
        outbox: createInvitationOutbox(email)
      })
      const created = await sharing.createInvitation(OWNER_ID, context.documentId, {
        email: 'person@example.com',
        permission: 'view'
      })
      expect(
        await context.runtime.database
          .selectFrom('transactionalEmail')
          .select(['idempotencyKey', 'status', 'payloadEncrypted'])
          .executeTakeFirstOrThrow()
      ).toMatchObject({
        idempotencyKey: `document-invitation/${created.invitation.id}`,
        status: 'pending',
        payloadEncrypted: expect.not.stringContaining(created.token)
      })
    } finally {
      await context.runtime.close()
    }
  })

  test('encrypts and consumes OAuth invitation continuations once', async () => {
    const context = await seedSharing()
    try {
      await assignOwnerUser(context, {
        id: OWNER_ID,
        name: 'Owner',
        email: 'owner-continuation@example.com'
      })
      const sharing = createDocumentSharingService(context.runtime.database, {
        continuationSecret: 'continuation-test-secret-at-least-32-characters'
      })
      const created = await sharing.createInvitation(OWNER_ID, context.documentId, {
        email: 'continuation@example.com',
        permission: 'view'
      })
      const continuation = await sharing.createInvitationContinuation({
        invitationId: created.invitation.id,
        token: created.token
      })
      const stored = await context.runtime.database
        .selectFrom('invitationContinuation')
        .select('tokenEncrypted')
        .where('id', '=', continuation.id)
        .executeTakeFirstOrThrow()
      expect(stored.tokenEncrypted).not.toContain(created.token)
      expect(stored.tokenEncrypted.split('.')).toHaveLength(5)
      expect(await sharing.consumeInvitationContinuation(continuation.id)).toEqual({
        invitationId: created.invitation.id,
        token: created.token
      })
      await expect(sharing.consumeInvitationContinuation(continuation.id)).rejects.toBeInstanceOf(
        DocumentShareInvalidError
      )
    } finally {
      await context.runtime.close()
    }
  })

  test('revokes invitations when synchronous compatibility delivery fails', async () => {
    const context = await seedSharing()
    try {
      await assignOwnerUser(context, {
        id: OWNER_ID,
        name: 'Owner',
        email: 'owner-delivery@example.com'
      })
      const sharing = createDocumentSharingService(context.runtime.database, {
        publicURL: 'https://cloud.example.com',
        appURL: 'https://app.example.com',
        delivery: {
          async sendDocumentInvitation() {
            throw new Error('SMTP unavailable')
          }
        }
      })
      await expect(
        sharing.createInvitation(OWNER_ID, context.documentId, {
          email: 'failed@example.com',
          permission: 'view'
        })
      ).rejects.toThrow('Invitation delivery failed')
      expect(
        await context.runtime.database
          .selectFrom('documentInvitation')
          .select('revokedAt')
          .where('emailNormalized', '=', 'failed@example.com')
          .executeTakeFirstOrThrow()
      ).toMatchObject({ revokedAt: expect.any(Date) })
    } finally {
      await context.runtime.close()
    }
  })
})
