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
 * administrator to review in the console; `request` sends no email, and `--waitlist` marks someone
 * from openpencil.dev's waitlist, whose approval with the invitation letter thanks them for joining
 * it. It needs only the database,
 * through `DATABASE_URL`, and refuses one this version's server has not migrated, rather than
 * migrating it under another version.
 */
const args = process.argv.slice(2)
const waitlist = args.includes('--waitlist')
const [operation, email, ...nameWords] = args.filter((arg) => arg !== '--waitlist')
if ((operation !== 'approve' && operation !== 'grant' && operation !== 'request') || !email) {
  throw new Error('Usage: admin <approve|grant|request> <email> [name] [--waitlist]')
}
if (waitlist && operation !== 'request') throw new Error('--waitlist only marks a request')
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
    const outcome = await createEnrollmentService(database).request({
      email,
      name: nameWords.join(' '),
      ...(waitlist && { source: 'waitlist' as const })
    })
    // An address already waiting or approved keeps its request, so it is not marked as waitlist.
    console.log(
      JSON.stringify(
        outcome === 'recorded'
          ? { requested: email, ...(waitlist && { waitlist }) }
          : { unchanged: email }
      )
    )
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
