#!/usr/bin/env node

import { createMigratedNodeCloudDatabase } from './bootstrap'

const [operation, email] = process.argv.slice(2)
if ((operation !== 'approve' && operation !== 'grant') || !email) {
  throw new Error('Usage: admin <approve|grant> <email>')
}

const { database } = await createMigratedNodeCloudDatabase(process.env)
try {
  const normalized = email.trim().toLowerCase()
  if (operation === 'approve') {
    await database
      .insertInto('cloudEnrollment')
      .values({
        id: crypto.randomUUID(),
        emailNormalized: normalized,
        name: null,
        reason: 'Administrative bootstrap',
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: 'cli-bootstrap',
        reviewNote: 'Approved through CLI bootstrap',
        approvedUserId: null
      })
      .onConflict((conflict) =>
        conflict.column('emailNormalized').doUpdateSet({
          status: 'approved',
          reviewedAt: new Date(),
          reviewedBy: 'cli-bootstrap',
          reviewNote: 'Approved through CLI bootstrap'
        })
      )
      .execute()
    console.log(JSON.stringify({ approved: normalized }))
  } else {
    const user = await database
      .selectFrom('user')
      .select(['id', 'email'])
      .where('email', '=', normalized)
      .executeTakeFirstOrThrow()
    await database.updateTable('user').set({ role: 'admin' }).where('id', '=', user.id).execute()
    await database
      .insertInto('cloudAdminAuditEvent')
      .values({
        id: crypto.randomUUID(),
        actorUserId: 'cli-bootstrap',
        action: 'user.admin-granted',
        subjectType: 'user',
        subjectId: user.id,
        metadata: { email: normalized }
      })
      .execute()
    console.log(JSON.stringify({ admin: normalized, userId: user.id }))
  }
} finally {
  await database.destroy()
}
