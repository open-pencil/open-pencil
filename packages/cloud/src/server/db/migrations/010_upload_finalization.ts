import type { Kysely } from 'kysely'

import { replaceCheckConstraint } from './helpers'

export async function up(database: Kysely<unknown>): Promise<void> {
  await replaceCheckConstraint(database, 'upload', 'upload_status_check', 'status', [
    'pending',
    'finalizing',
    'cleaning',
    'committed',
    'abandoned'
  ])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await replaceCheckConstraint(database, 'upload', 'upload_status_check', 'status', [
    'pending',
    'cleaning',
    'committed',
    'abandoned'
  ])
}
