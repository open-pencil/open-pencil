import type { Kysely } from 'kysely'

/**
 * A room's edits as an append-only log beside its snapshot, so a save writes what changed instead
 * of the whole room. The snapshot records the last logged update it holds; compaction replaces it
 * and drops the updates it covers.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .alterTable('documentCollaborationState')
    .addColumn('throughSequence', 'integer', (column) => column.notNull().defaultTo(0))
    .execute()
  await database.schema
    .createTable('documentCollaborationUpdate')
    .addColumn('documentId', 'uuid', (column) =>
      column.notNull().references('document.id').onDelete('cascade')
    )
    .addColumn('roomEpoch', 'integer', (column) => column.notNull())
    .addColumn('sequence', 'integer', (column) => column.notNull())
    .addColumn('data', 'bytea', (column) => column.notNull())
    .addColumn('createdAt', 'timestamptz', (column) =>
      column.notNull().defaultTo(database.fn('now'))
    )
    .addPrimaryKeyConstraint('documentCollaborationUpdatePrimary', [
      'documentId',
      'roomEpoch',
      'sequence'
    ])
    .execute()
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await database.schema.dropTable('documentCollaborationUpdate').execute()
  await database.schema
    .alterTable('documentCollaborationState')
    .dropColumn('throughSequence')
    .execute()
}
