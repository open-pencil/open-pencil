#!/usr/bin/env node

import { createPostgresCloudDatabase } from '#cloud/runtime/postgres/database'
import {
  approveEnrollmentByEmail,
  grantDeploymentAdminByEmail,
  pendingCloudMigrations
} from '#cloud/server'

/**
 * Approves a person and makes them a deployment administrator, for a deployment that has none
 * to do it in the console. It needs only the database, through `DATABASE_URL`, and refuses one
 * this version's server has not migrated, rather than migrating it under another version.
 */
const [operation, email] = process.argv.slice(2)
if ((operation !== 'approve' && operation !== 'grant') || !email) {
  throw new Error('Usage: admin <approve|grant> <email>')
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
  console.log(
    JSON.stringify(
      operation === 'approve'
        ? { approved: await approveEnrollmentByEmail(database, email) }
        : await grantDeploymentAdminByEmail(database, email)
    )
  )
} finally {
  await database.destroy()
}
