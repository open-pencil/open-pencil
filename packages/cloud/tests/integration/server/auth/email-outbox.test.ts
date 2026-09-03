import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'

import {
  createAuthenticationEmailService,
  createTransactionalEmailService
} from '@open-pencil/cloud/server'

describe('authentication email outbox', () => {
  test('enqueues verification, reset, and password-change messages without storing raw tokens', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const email = createTransactionalEmailService(runtime.database, {
        encryptionSecret: 'authentication-email-test-secret-at-least-32-characters',
        from: 'cloud@example.com'
      })
      const service = createAuthenticationEmailService(email, 'https://cloud.example.com')
      await service.sendVerification({
        email: 'person@example.com',
        name: 'Person',
        token: 'verification-token',
        url: 'https://cloud.example.com/api/auth/verify-email?token=verification-token'
      })
      await service.sendPasswordReset({
        email: 'person@example.com',
        name: 'Person',
        token: 'reset-token',
        url: 'https://cloud.example.com/api/auth/reset-password/reset-token'
      })
      await service.sendPasswordChanged({
        email: 'person@example.com',
        name: 'Person',
        userId: '11111111-1111-4111-8111-111111111111',
        url: 'https://cloud.example.com'
      })
      const messages = await runtime.database
        .selectFrom('transactionalEmail')
        .select(['kind', 'idempotencyKey', 'payloadEncrypted'])
        .orderBy('createdAt')
        .execute()
      expect(messages.map((message) => message.kind)).toEqual([
        'email-verification',
        'password-reset',
        'password-changed'
      ])
      expect(JSON.stringify(messages)).not.toContain('verification-token')
      expect(JSON.stringify(messages)).not.toContain('reset-token')
      expect(messages.every((message) => Boolean(message.payloadEncrypted))).toBe(true)
    } finally {
      await runtime.close()
    }
  })
})
