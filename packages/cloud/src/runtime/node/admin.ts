#!/usr/bin/env node

import { createPostgresCloudDatabase } from '#cloud/runtime/postgres/database'
import {
  approveEnrollmentByEmail,
  createEnrollmentService,
  grantDeploymentAdminByEmail,
  pendingCloudMigrations
} from '#cloud/server'

/**
 * Approves a person and makes them a deployment administrator, for a deployment that has none
 * to do it in the console, or records a request for access, as if they had asked here, for an
 * administrator to review in the console; `request` sends no email. It needs only the database,
 * through `DATABASE_URL`, and refuses one this version's server has not migrated, rather than
 * migrating it under another version.
 */
const [operation, email, ...nameWords] = process.argv.slice(2)
if ((operation !== 'approve' && operation !== 'grant' && operation !== 'request') || !email) {
  throw new Error('Usage: admin <approve|grant|request> <email> [name]')
}
const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL must name the deployment database')

const database = createPostgresCloudDatabase({ connectionString })
try {
  const pending = await pendingCloudMigrations(database)
  if (pending.length > 0) {
    throw new Error(
      `The database has not run ${pending.join(', ')}; deploy this version or run migrate first`
    )
  }
  if (operation === 'request') {
    await createEnrollmentService(database).request({ email, name: nameWords.join(' ') })
    console.log(JSON.stringify({ requested: email }))
  } else {
    console.log(
      JSON.stringify(
        operation === 'approve'
          ? { approved: await approveEnrollmentByEmail(database, email) }
          : await grantDeploymentAdminByEmail(database, email)
      )
    )
  }
} finally {
  await database.destroy()
}
