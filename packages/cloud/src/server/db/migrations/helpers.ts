import { checkColumnIn, CURRENT_TIMESTAMP } from '#cloud/server/db/expressions'
import type { Kysely } from 'kysely'

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
