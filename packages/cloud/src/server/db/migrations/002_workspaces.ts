import type { Kysely } from 'kysely'

import { addChecks, addIndexes, dropTables, now, required, ROLES, withInvitation } from './schema'

/** Workspaces, their members, and the people invited to join. */
const TABLES = ['workspace', 'workspace_member', 'workspace_invitation']

export async function up(database: Kysely<unknown>): Promise<void> {
  // A workspace takes its limits from its owner's plan.
  await database.schema
    .createTable('workspace')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('name', 'text', required)
    .addColumn('slug', 'text', (column) => column.notNull().unique())
    .addColumn('created_by', 'text', required)
    .addColumn('owner_id', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('updated_at', 'timestamptz', now)
    .execute()
  await database.schema
    .createTable('workspace_member')
    .addColumn('workspace_id', 'uuid', (column) =>
      column.notNull().references('workspace.id').onDelete('cascade')
    )
    .addColumn('user_id', 'text', required)
    .addColumn('role', 'text', required)
    .addColumn('created_at', 'timestamptz', now)
    .addPrimaryKeyConstraint('workspace_member_pkey', ['workspace_id', 'user_id'])
    .execute()
  await withInvitation(database.schema.createTable('workspace_invitation'), 'role')
    .addColumn('workspace_id', 'uuid', (column) =>
      column.notNull().references('workspace.id').onDelete('cascade')
    )
    .execute()
  await addChecks(database, [
    ['workspace_member', 'role', ROLES],
    ['workspace_invitation', 'role', ROLES]
  ])
  await addIndexes(database, [
    ['workspace', ['owner_id']],
    ['workspace_member', ['user_id']],
    ['workspace_invitation', ['workspace_id', 'revoked_at']]
  ])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await dropTables(database, TABLES)
}
