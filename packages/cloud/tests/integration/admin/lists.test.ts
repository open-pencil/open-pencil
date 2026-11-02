import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import {
  createAdminAuditService,
  createAdminEmailService,
  createEnrollmentService
} from '#cloud/server'

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const ADA_ID = '22222222-2222-4222-8222-222222222222'

describe('admin lists', () => {
  test('search, filter, and page access requests, counting each status', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const enrollment = createEnrollmentService(runtime.database)
      for (const name of ['Ada', 'Grace', 'Alan', 'Ada Two']) {
        await enrollment.request({ email: `${name.replace(' ', '.')}@example.com`, name })
      }
      const [first] = (await enrollment.list({ search: 'grace' })).enrollments
      if (!first) throw new Error('Expected a request from Grace')
      await runtime.database
        .insertInto('user')
        .values({ id: ADMIN_ID, name: 'Admin', email: 'admin@example.com', emailVerified: true })
        .execute()
      await enrollment.review(ADMIN_ID, first.id, 'approved', {})
      const [approved] = (await enrollment.list({ filter: 'approved' })).enrollments
      expect(approved).toMatchObject({ name: 'Grace', reviewedBy: ADMIN_ID, reviewerName: 'Admin' })

      const ada = await enrollment.list({ search: 'ADA' })
      expect(ada.enrollments.map((request) => request.name).sort()).toEqual(['Ada', 'Ada Two'])
      expect(ada.counts).toEqual({ pending: 2, approved: 0, rejected: 0, revoked: 0 })

      const page = await enrollment.list({ limit: 2, offset: 2 })
      expect(page.enrollments).toHaveLength(1)
      expect(page.total).toBe(3)
      expect(page.counts).toEqual({ pending: 3, approved: 1, rejected: 0, revoked: 0 })

      // `%` and `_` are searched for as they are, not as patterns.
      expect((await enrollment.list({ search: '%' })).total).toBe(0)
    } finally {
      await runtime.close()
    }
  })

  test('search and filter email by recipient and delivery', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const sent = new Date('2026-10-01T10:00:00Z')
      const message = (
        index: number,
        recipient: string,
        status: 'accepted' | 'failed' | 'pending'
      ) => ({
        id: crypto.randomUUID(),
        idempotencyKey: `list-test/${index}`,
        kind: 'email-verification' as const,
        recipientEmailNormalized: recipient,
        payloadEncrypted: null,
        status,
        nextAttemptAt: sent,
        createdAt: new Date(sent.getTime() + index * 1000),
        updatedAt: sent
      })
      await runtime.database
        .insertInto('transactionalEmail')
        .values([
          message(1, 'ada@example.com', 'accepted'),
          message(2, 'grace@example.com', 'failed'),
          message(3, 'ada@example.com', 'pending')
        ])
        .execute()
      const email = createAdminEmailService(runtime.database)

      const all = await email.list()
      expect(all.messages.map((row) => row.status)).toEqual(['pending', 'failed', 'accepted'])
      expect(all.counts).toEqual({ all: 3, sent: 1, waiting: 1, failed: 1 })

      const ada = await email.list({ search: 'ada', filter: 'sent' })
      expect(ada.messages.map((row) => row.recipientEmailNormalized)).toEqual(['ada@example.com'])
      expect(ada.total).toBe(1)
      expect(ada.counts).toEqual({ all: 2, sent: 1, waiting: 1, failed: 0 })
    } finally {
      await runtime.close()
    }
  })

  test('search activity by the names of who acted and whom it was about', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      await runtime.database
        .insertInto('user')
        .values([
          { id: ADMIN_ID, name: 'Admin', email: 'admin@example.com', emailVerified: true },
          { id: ADA_ID, name: 'Ada Lovelace', email: 'ada@example.com', emailVerified: true }
        ])
        .execute()
      const at = new Date('2026-10-01T10:00:00Z')
      const event = (index: number, action: string, subjectType: string, subjectId: string) => ({
        id: crypto.randomUUID(),
        actorUserId: ADMIN_ID,
        action,
        subjectType,
        subjectId,
        metadata: {},
        createdAt: new Date(at.getTime() + index * 1000)
      })
      await runtime.database
        .insertInto('adminAuditEvent')
        .values([
          event(1, 'user.banned', 'user', ADA_ID),
          event(2, 'email.regenerated', 'transactional-email', crypto.randomUUID()),
          event(3, 'user.unbanned', 'user', ADA_ID)
        ])
        .execute()
      const audit = createAdminAuditService(runtime.database)

      const lovelace = await audit.list({ search: 'lovelace' })
      expect(lovelace.events.map((row) => row.action)).toEqual(['user.unbanned', 'user.banned'])
      expect(lovelace.counts).toEqual({ all: 2, accounts: 2, requests: 0, email: 0 })

      // Everything here was done by Admin, so searching for them finds every event.
      const admin = await audit.list({ search: 'admin@example', filter: 'email' })
      expect(admin.events.map((row) => row.action)).toEqual(['email.regenerated'])
      expect(admin.counts).toEqual({ all: 3, accounts: 2, requests: 0, email: 1 })

      const page = await audit.list({ limit: 1, offset: 1 })
      expect(page.events.map((row) => row.action)).toEqual(['email.regenerated'])
      expect(page.total).toBe(3)
    } finally {
      await runtime.close()
    }
  })
})
