import { checkColumnIn, CURRENT_TIMESTAMP } from '#cloud/server/db/expressions'
import type { AuthSchemaVersionTable } from '#cloud/server/db/tables'
import type { CreateTableBuilder, Kysely } from 'kysely'

export async function addCheckConstraint(
  database: Kysely<unknown>,
  table: string,
  constraint: string,
  column: string,
  values: readonly string[]
): Promise<void> {
  await database.schema
    .alterTable(table)
    .addCheckConstraint(constraint, checkColumnIn(column, values))
    .execute()
}

export async function replaceCheckConstraint(
  database: Kysely<unknown>,
  table: string,
  constraint: string,
  column: string,
  values: readonly string[]
): Promise<void> {
  await database.schema.alterTable(table).dropConstraint(constraint).execute()
  await addCheckConstraint(database, table, constraint, column, values)
}

export async function addCurrentTimestampColumns(
  database: Kysely<unknown>,
  table: string,
  columns: readonly string[]
): Promise<void> {
  for (const column of columns) {
    await database.schema
      .alterTable(table)
      .addColumn(column, 'timestamptz', (definition) =>
        definition.notNull().defaultTo(CURRENT_TIMESTAMP)
      )
      .execute()
  }
}

type InvitationColumn =
  | 'email_normalized'
  | 'token_hash'
  | 'invited_by'
  | 'expires_at'
  | 'accepted_at'
  | 'revoked_at'

/**
 * What every emailed invitation keeps: whom it went to, the access it grants (`permission` on a
 * document, `role` in a workspace), its hashed secret, and its lifecycle.
 */
export function addInvitationColumns<
  Table extends string,
  Column extends string,
  Access extends 'permission' | 'role'
>(
  table: CreateTableBuilder<Table, Column>,
  access: Access
): CreateTableBuilder<Table, Column | InvitationColumn | Access> {
  return table
    .addColumn('email_normalized', 'text', (column) => column.notNull())
    .addColumn(access, 'text', (column) => column.notNull())
    .addColumn('token_hash', 'text', (column) => column.notNull())
    .addColumn('invited_by', 'text', (column) => column.notNull())
    .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
    .addColumn('accepted_at', 'timestamptz')
    .addColumn('revoked_at', 'timestamptz')
}

/**
 * The Better Auth schema record under the name it had before `025_table_names`, for the
 * migrations that ran while it was `cloud_auth_schema`; they must keep emitting the same SQL.
 */
export type LegacyAuthSchemaDatabase = { cloudAuthSchema: AuthSchemaVersionTable }
