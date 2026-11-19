import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase, type CloudTestDatabase } from '#cloud-tests/helpers/database'
import {
  approveEnrollmentByEmail,
  createCloudDatabase,
  createEnrollmentService,
  grantDeploymentAdminByEmail,
  pendingCloudMigrations
} from '#cloud/server'
import { PGlite } from '@electric-sql/pglite'
import { sortBy } from 'es-toolkit'
import { PGliteDialect } from 'kysely-pglite-dialect'

const USER_ID = '55555555-5555-4555-8555-555555555555'

async function insertOwner(database: CloudTestDatabase['database']): Promise<void> {
  await database
    .insertInto('user')
    .values({
      id: USER_ID,
      name: 'Owner',
      email: 'owner@example.com',
      emailVerified: true,
      image: null,
      role: 'user',
      banned: false
    })
    .execute()
}

describe('Admin bootstrap', () => {
  test('approves a pending request, or an email that has not asked yet', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const enrollment = createEnrollmentService(runtime.database)
      await enrollment.request({ email: 'owner@example.com', name: 'Owner' })
      expect(await approveEnrollmentByEmail(runtime.database, ' Owner@Example.com ')).toBe(
        'owner@example.com'
      )
      expect(await approveEnrollmentByEmail(runtime.database, 'second@example.com')).toBe(
        'second@example.com'
      )
      const { enrollments } = await enrollment.list({ filter: 'approved' })
      expect(
        sortBy(enrollments, ['email']).map(({ email, status }) => ({ email, status }))
      ).toEqual([
        { email: 'owner@example.com', status: 'approved' },
        { email: 'second@example.com', status: 'approved' }
      ])
    } finally {
      await runtime.close()
    }
  })

  test('binds the account that uses the address, so the approval follows its email change', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const enrollment = createEnrollmentService(runtime.database)
      await insertOwner(runtime.database)
      await enrollment.request({ email: 'owner@example.com', name: 'Owner' })
      await approveEnrollmentByEmail(runtime.database, 'owner@example.com')
      await enrollment.followEmailChange(USER_ID, 'renamed@example.com')
      const [approved] = (await enrollment.list({ filter: 'approved' })).enrollments
      expect(approved).toMatchObject({ email: 'renamed@example.com', approvedUserId: USER_ID })
      const events = await runtime.database
        .selectFrom('adminAuditEvent')
        .select(['actorUserId', 'action'])
        .execute()
      expect(events).toEqual([{ actorUserId: 'cli-bootstrap', action: 'enrollment.approved' }])
    } finally {
      await runtime.close()
    }
  })

  test('grants an existing account and records it in the audit trail', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      await insertOwner(runtime.database)
      expect(await grantDeploymentAdminByEmail(runtime.database, 'OWNER@example.com')).toEqual({
        email: 'owner@example.com',
        userId: USER_ID
      })
      const user = await runtime.database
        .selectFrom('user')
        .select('role')
        .where('id', '=', USER_ID)
        .executeTakeFirstOrThrow()
      expect(user.role).toBe('admin')
      const events = await runtime.database
        .selectFrom('adminAuditEvent')
        .select(['actorUserId', 'action', 'subjectId'])
        .execute()
      expect(events).toEqual([
        { actorUserId: 'cli-bootstrap', action: 'user.admin-granted', subjectId: USER_ID }
      ])
    } finally {
      await runtime.close()
    }
  })

  test('refuses to grant an email no account uses, writing nothing', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      await expect(
        grantDeploymentAdminByEmail(runtime.database, 'nobody@example.com')
      ).rejects.toThrow('signs in once first')
      const events = await runtime.database.selectFrom('adminAuditEvent').select('id').execute()
      expect(events).toEqual([])
    } finally {
      await runtime.close()
    }
  })

  test('lists the migrations a database has not run', async () => {
    const runtime = await createCloudTestDatabase()
    const empty = createCloudDatabase({
      dialect: new PGliteDialect(await PGlite.create({ dataDir: 'memory://' }))
    })
    try {
      expect(await pendingCloudMigrations(runtime.database)).toEqual([])
      const pending = await pendingCloudMigrations(empty)
      expect(pending[0]).toBe('001_accounts')
      expect(pending).toContain('006_operations')
    } finally {
      await runtime.close()
      await empty.destroy()
    }
  })
})
