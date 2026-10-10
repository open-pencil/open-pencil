import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import {
  createAdminEmailService,
  createTransactionalEmailService,
  AdminDomainError
} from '#cloud/server'

const CLOUD_LINKS = { appURL: 'https://cloud.example.com', portalURL: 'https://cloud.example.com' }

describe('admin email regeneration', () => {
  test('regenerates an enrollment message from authoritative enrollment state', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      await runtime.database
        .insertInto('cloudEnrollment')
        .values({
          id: crypto.randomUUID(),
          emailNormalized: 'person@example.com',
          name: 'Person',
          reason: null,
          status: 'approved',
          reviewedAt: new Date(),
          reviewedBy: 'admin',
          reviewNote: null,
          approvedUserId: null
        })
        .execute()
      const email = createTransactionalEmailService(runtime.database, {
        encryptionSecret: 'regeneration-secret-at-least-32-characters',
        from: 'cloud@example.com'
      })
      const original = await email.enqueue({
        idempotencyKey: 'original',
        kind: 'enrollment-approved',
        recipientEmail: 'person@example.com',
        payload: { name: 'Person', actionURL: 'https://cloud.example.com' }
      })
      await runtime.database
        .updateTable('transactionalEmail')
        .set({ status: 'failed', payloadEncrypted: null })
        .where('id', '=', original)
        .execute()
      await createAdminEmailService(runtime.database, email, CLOUD_LINKS).regenerate(
        'admin',
        original
      )
      const rows = await runtime.database
        .selectFrom('transactionalEmail')
        .select(['id', 'kind', 'status'])
        .orderBy('createdAt')
        .execute()
      expect(rows).toHaveLength(2)
      expect(rows[1]).toMatchObject({ kind: 'enrollment-approved', status: 'pending' })
      expect(
        await runtime.database
          .selectFrom('cloudAdminAuditEvent')
          .select('action')
          .executeTakeFirstOrThrow()
      ).toEqual({ action: 'email.regenerated' })
    } finally {
      await runtime.close()
    }
  })
  test('rejects regeneration when authoritative data is unavailable', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const email = createTransactionalEmailService(runtime.database, {
        encryptionSecret: 'regeneration-secret-at-least-32-characters',
        from: 'cloud@example.com'
      })
      const id = await email.enqueue({
        idempotencyKey: 'invitation',
        kind: 'document-invitation',
        recipientEmail: 'person@example.com',
        payload: {
          inviterName: 'A',
          documentName: 'D',
          permission: 'view',
          expiresAt: new Date().toISOString(),
          acceptanceURL: 'https://example.com'
        }
      })
      await expect(
        createAdminEmailService(runtime.database, email, CLOUD_LINKS).regenerate('admin', id)
      ).rejects.toBeInstanceOf(AdminDomainError)
    } finally {
      await runtime.close()
    }
  })
})
