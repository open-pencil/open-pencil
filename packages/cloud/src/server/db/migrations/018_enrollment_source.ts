import { sql, type Kysely } from 'kysely'

/**
 * Where an access request came from: null when the person asked on this server, `waitlist` when an
 * administrator recorded someone from openpencil.dev's waitlist, whose approval with the invitation
 * letter thanks them for joining the waitlist rather than for asking. Earlier requests asked here.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .alterTable('enrollment')
    .addColumn('source', 'text', (column) => column.check(sql`source in ('waitlist')`))
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.alterTable('enrollment').dropColumn('source').execute()
}
