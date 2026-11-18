import type { Kysely } from 'kysely'

import { now, required } from './schema'

/** Which version of the deployment's terms each account accepted, and when. */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('terms_acceptance')
    .addColumn('user_id', 'text', required)
    .addColumn('version', 'text', required)
    .addColumn('accepted_at', 'timestamptz', now)
    .addPrimaryKeyConstraint('terms_acceptance_pkey', ['user_id', 'version'])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('terms_acceptance').execute()
}
