import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'

import {
  createTransactionalEmailService,
  TransactionalEmailTransportError
} from '@open-pencil/cloud/server'

const secret = 'transactional-email-test-secret-at-least-32-characters'
const invitation = {
  inviterName: 'Alice',
  documentName: 'Homepage',
  permission: 'view' as const,
  expiresAt: '2026-01-08T00:00:00.000Z',
  acceptanceURL: 'https://app.example.com/cloud/invitations/id#secret-token'
}

describe('transactional email outbox', () => {
  test('encrypts payloads and deduplicates logical messages', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const email = createTransactionalEmailService(runtime.database, {
        encryptionSecret: secret,
        from: 'OpenPencil <cloud@example.com>'
      })
      const input = {
        idempotencyKey: 'document-invitation/invitation-id',
        kind: 'document-invitation' as const,
        recipientEmail: 'Person@Example.com',
        payload: invitation
      }
      const first = await email.enqueue(input)
      expect(await email.enqueue(input)).toBe(first)
      const rows = await runtime.database.selectFrom('transactionalEmail').selectAll().execute()
      expect(rows).toHaveLength(1)
      expect(rows[0]?.recipientEmailNormalized).toBe('person@example.com')
      const encryptedPayload = rows[0]?.payloadEncrypted
      if (!encryptedPayload) throw new Error('Expected an encrypted transactional email payload')
      expect(encryptedPayload).not.toContain('secret-token')
      expect(encryptedPayload.split('.')).toHaveLength(5)
    } finally {
      await runtime.close()
    }
  })

  test('claims, renders, and records transport acceptance', async () => {
    const runtime = await createCloudTestDatabase()
    const sent: unknown[] = []
    try {
      const email = createTransactionalEmailService(runtime.database, {
        encryptionSecret: secret,
        from: 'OpenPencil <cloud@example.com>',
        transport: {
          id: 'memory',
          async send(message) {
            sent.push(message)
            return { transportMessageId: 'message-id', acceptedAt: '2026-01-01T00:00:00.000Z' }
          }
        }
      })
      await email.enqueue({
        idempotencyKey: 'document-invitation/accepted',
        kind: 'document-invitation',
        recipientEmail: 'person@example.com',
        payload: invitation
      })
      expect(await email.deliverPending({ batchSize: 10, leaseDurationMs: 60_000 })).toEqual({
        claimed: 1,
        accepted: 1,
        retrying: 0,
        failed: 0,
        suppressed: 0
      })
      expect(sent).toHaveLength(1)
      expect(sent[0]).toMatchObject({
        to: 'person@example.com',
        subject: 'Alice invited you to view Homepage'
      })
      expect(
        await runtime.database
          .selectFrom('transactionalEmail')
          .select(['status', 'attemptCount', 'transport', 'transportMessageId', 'payloadEncrypted'])
          .executeTakeFirstOrThrow()
      ).toMatchObject({
        status: 'accepted',
        attemptCount: 1,
        transport: 'memory',
        transportMessageId: 'message-id',
        payloadEncrypted: null
      })
    } finally {
      await runtime.close()
    }
  })

  test('retries transient failures and terminates suppressed recipients', async () => {
    const runtime = await createCloudTestDatabase()
    let suppressed = false
    try {
      const email = createTransactionalEmailService(runtime.database, {
        encryptionSecret: secret,
        from: 'OpenPencil <cloud@example.com>',
        transport: {
          id: 'memory',
          async send() {
            throw new TransactionalEmailTransportError(
              suppressed ? 'suppressed' : 'transient',
              suppressed ? 'suppressed' : 'temporary',
              'Rejected'
            )
          }
        }
      })
      await email.enqueue({
        idempotencyKey: 'document-invitation/retry',
        kind: 'document-invitation',
        recipientEmail: 'person@example.com',
        payload: invitation
      })
      const now = new Date(Date.now() + 1000)
      expect(await email.deliverPending({ batchSize: 1, leaseDurationMs: 60_000, now })).toEqual({
        claimed: 1,
        accepted: 0,
        retrying: 1,
        failed: 0,
        suppressed: 0
      })
      suppressed = true
      expect(
        await email.deliverPending({
          batchSize: 1,
          leaseDurationMs: 60_000,
          now: new Date(now.getTime() + 60_000)
        })
      ).toEqual({ claimed: 1, accepted: 0, retrying: 0, failed: 0, suppressed: 1 })
      expect(
        await runtime.database
          .selectFrom('transactionalEmail')
          .select(['status', 'attemptCount', 'lastErrorCode', 'payloadEncrypted'])
          .executeTakeFirstOrThrow()
      ).toEqual({
        status: 'suppressed',
        attemptCount: 2,
        lastErrorCode: 'suppressed',
        payloadEncrypted: null
      })
    } finally {
      await runtime.close()
    }
  })
})
