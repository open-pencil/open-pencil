import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'

import {
  createEnrollmentService,
  createTransactionalEmailService,
  PostgresRateLimitStore
} from '@open-pencil/cloud/server'

describe('Cloud enrollment integration', () => {
  test('deduplicates requests and applies audited reviews', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const enrollment = createEnrollmentService(runtime.database)
      await enrollment.request({ email: 'Person@Example.com', name: 'Person', reason: 'Design' })
      await enrollment.request({ email: 'person@example.com', name: 'Duplicate' })
      const [pending] = await enrollment.list('pending')
      expect(pending).toMatchObject({
        email: 'person@example.com',
        name: 'Person',
        status: 'pending'
      })
      if (!pending) throw new Error('Expected pending enrollment')
      await runtime.database
        .insertInto('user')
        .values({
          id: '44444444-4444-4444-8444-444444444444',
          name: 'Person',
          email: 'person@example.com',
          emailVerified: true,
          image: null,
          role: 'user',
          banned: false
        })
        .execute()
      expect(
        await enrollment.review('admin-user', pending.id, 'approved', { note: 'Early access' })
      ).toMatchObject({
        status: 'approved',
        approvedUserId: '44444444-4444-4444-8444-444444444444',
        reviewedBy: 'admin-user',
        reviewNote: 'Early access'
      })
      expect(await enrollment.isApproved('PERSON@example.com')).toBe(true)
      expect(await enrollment.statusForEmail('PERSON@example.com')).toBe('approved')
      expect(
        await runtime.database
          .selectFrom('cloudAdminAuditEvent')
          .select('action')
          .executeTakeFirstOrThrow()
      ).toEqual({ action: 'enrollment.approved' })
    } finally {
      await runtime.close()
    }
  })

  test('reopens rejected requests, enforces transitions, and enqueues review email', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const email = createTransactionalEmailService(runtime.database, {
        encryptionSecret: 'enrollment-test-secret-at-least-32-characters',
        from: 'cloud@example.com'
      })
      const enrollment = createEnrollmentService(runtime.database, {
        appURL: 'https://cloud.example.com',
        adminRecipients: ['admin@example.com'],
        email
      })
      await enrollment.request({ email: 'person@example.com', name: 'Person', reason: 'Design' })
      let [record] = await enrollment.list()
      if (!record) throw new Error('Expected enrollment')
      expect(record.requestRevision).toBe(1)
      expect(
        await runtime.database
          .selectFrom('transactionalEmail')
          .select(({ fn }) => fn.countAll<number>().as('count'))
          .executeTakeFirstOrThrow()
      ).toEqual({ count: 2 })
      await enrollment.review('admin-user', record.id, 'rejected', {})
      await expect(enrollment.review('admin-user', record.id, 'revoked', {})).rejects.toThrow(
        'Enrollment cannot transition'
      )
      await enrollment.request({ email: 'person@example.com', reason: 'Try again' })
      ;[record] = await enrollment.list()
      expect(record).toMatchObject({ status: 'pending', requestRevision: 2, reason: 'Try again' })
      if (!record) throw new Error('Expected reopened enrollment')
      await enrollment.review('admin-user', record.id, 'approved', {})
      expect(
        await runtime.database
          .selectFrom('transactionalEmail')
          .select(({ fn }) => fn.countAll<number>().as('count'))
          .executeTakeFirstOrThrow()
      ).toEqual({ count: 6 })
    } finally {
      await runtime.close()
    }
  })

  test('persists atomic rate limits without storing raw keys', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const store = new PostgresRateLimitStore(runtime.database, 'secret', 'enrollment-email', {
        windowMs: 60_000
      })
      const results = await Promise.all(
        Array.from({ length: 20 }, () => store.increment('person@example.com'))
      )
      expect(Math.max(...results.map((result) => result.totalHits))).toBe(20)
      expect(
        await runtime.database
          .selectFrom('cloudRateLimit')
          .select(['keyHash', 'requestCount'])
          .executeTakeFirstOrThrow()
      ).toMatchObject({
        requestCount: 20,
        keyHash: expect.not.stringContaining('person@example.com')
      })
    } finally {
      await runtime.close()
    }
  })
})
