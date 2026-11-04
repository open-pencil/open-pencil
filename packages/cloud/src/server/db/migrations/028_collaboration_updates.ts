import type { CloudDatabase } from '#cloud/server/db/tables'
import type { Kysely } from 'kysely'

/** The renamed table's constraints, whose names spelled its old name. */
const CONSTRAINTS = [
  ['documentCollaborationStatePrimary', 'documentRoomSnapshotPrimary'],
  ['documentCollaborationStateDocumentIdFkey', 'documentRoomSnapshotDocumentIdFkey']
] as const

async function renameConstraints(database: Kysely<CloudDatabase>, direction: 'up' | 'down') {
  for (const [old, current] of CONSTRAINTS) {
    const [from, to] = direction === 'up' ? [old, current] : [current, old]
    await database.schema.alterTable('documentRoomSnapshot').renameConstraint(from, to).execute()
  }
}

/** Moves every document with a saved room to a new epoch, and drops the saved rooms. */
export async function startRoomsOver(database: Kysely<CloudDatabase>): Promise<void> {
  await database
    .updateTable('document')
    .set((expression) => ({ collaborationEpoch: expression('collaborationEpoch', '+', 1) }))
    .where('id', 'in', database.selectFrom('documentRoomSnapshot').select('documentId'))
    .execute()
  await database.deleteFrom('documentRoomSnapshot').execute()
}

/**
 * A room's edits as an append-only log beside a snapshot kept in the object store, so a save
 * writes what changed instead of the whole room, and the room's bulk lives with the documents'
 * files rather than in the database. The snapshot row names its stored file and the last logged
 * update it holds; compaction points it at a new file and drops the updates it covers.
 *
 * Rooms saved before held their snapshots in the row itself. Those rows go, and each such
 * document moves to a new collaboration epoch, so its next room starts from its last saved
 * revision and no tab's local copy of the earlier room joins it.
 */
export async function up(database: Kysely<CloudDatabase>): Promise<void> {
  await database.schema
    .alterTable('documentCollaborationState')
    .renameTo('documentRoomSnapshot')
    .execute()
  await renameConstraints(database, 'up')
  await startRoomsOver(database)
  await database.schema
    .alterTable('documentRoomSnapshot')
    .dropColumn('state')
    .dropColumn('version')
    .addColumn('snapshotObjectId', 'uuid', (column) =>
      column.notNull().references('storageObject.id')
    )
    .addColumn('throughSequence', 'integer', (column) => column.notNull())
    .execute()
  await database.schema
    .createTable('documentRoomUpdate')
    .addColumn('documentId', 'uuid', (column) =>
      column.notNull().references('document.id').onDelete('cascade')
    )
    .addColumn('roomEpoch', 'integer', (column) => column.notNull())
    .addColumn('sequence', 'integer', (column) => column.notNull())
    .addColumn('data', 'bytea', (column) => column.notNull())
    .addColumn('createdAt', 'timestamptz', (column) =>
      column.notNull().defaultTo(database.fn('now'))
    )
    .addPrimaryKeyConstraint('documentRoomUpdatePrimary', ['documentId', 'roomEpoch', 'sequence'])
    .execute()
}

/** Back to snapshots in rows; the rooms saved meanwhile start over, as they did going up. */
export async function down(database: Kysely<CloudDatabase>): Promise<void> {
  await database.schema.dropTable('documentRoomUpdate').execute()
  await database.deleteFrom('documentRoomSnapshot').execute()
  await database.schema
    .alterTable('documentRoomSnapshot')
    .dropColumn('snapshotObjectId')
    .dropColumn('throughSequence')
    .addColumn('state', 'bytea', (column) => column.notNull())
    .addColumn('version', 'integer', (column) => column.notNull().defaultTo(1))
    .execute()
  await renameConstraints(database, 'down')
  await database.schema
    .alterTable('documentRoomSnapshot')
    .renameTo('documentCollaborationState')
    .execute()
}
