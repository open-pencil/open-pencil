import { sql, type Kysely } from 'kysely'

/** Tables Better Auth creates through its own migrations, under its own names. */
const BETTER_AUTH_TABLES = new Set([
  'user',
  'session',
  'account',
  'verification',
  'device_code',
  'rate_limit',
  'two_factor',
  'passkey'
])

/** Kysely's migration history, whose names Kysely chooses. */
const HISTORY_TABLES = new Set([
  'kysely_migration',
  'kysely_migration_lock',
  'services_migration',
  'services_migration_lock'
])

export type Named = { table: string; name: string; kind: string }

/** The constraints and indexes of the tables OpenPencil’s migrations own. */
export async function ownedNames<Database>(database: Kysely<Database>): Promise<Named[]> {
  const constraints = await sql<Named>`
    select conrelid::regclass::text as table, conname as name, contype::text as kind
    from pg_constraint where connamespace = 'public'::regnamespace`.execute(database)
  const indexes = await sql<Named>`
    select tablename as table, indexname as name, 'index' as kind
    from pg_indexes where schemaname = 'public'`.execute(database)
  return [...constraints.rows, ...indexes.rows].filter(
    (entry) =>
      !BETTER_AUTH_TABLES.has(entry.table.replaceAll('"', '')) && !HISTORY_TABLES.has(entry.table)
  )
}

/** PostgreSQL's own naming: `<table>_pkey`, `_key`, `_fkey`, `_check`, and `_idx` for indexes. */
export function followsConvention({ table, name, kind }: Named): boolean {
  if (!name.startsWith(`${table}_`)) return false
  const suffix: Record<string, RegExp> = {
    p: /_pkey$/,
    u: /_key$/,
    f: /_fkey$/,
    c: /_check$/,
    index: /_(pkey|key|idx)$/
  }
  return suffix[kind]?.test(name) ?? false
}

/** A column as code reading and writing it depends on. */
export type ColumnShape = {
  table: string
  column: string
  type: string
  nullable: boolean
  hasDefault: boolean
}

/** The columns of every table in `public`, keyed `table.column`. */
export async function columnShapes<Database>(
  database: Kysely<Database>
): Promise<Map<string, ColumnShape>> {
  const columns = await sql<{
    table: string
    column: string
    type: string
    nullable: string
    default: string | null
  }>`
    select table_name as table, column_name as column, data_type as type,
      is_nullable as nullable, column_default as default
    from information_schema.columns where table_schema = 'public'`.execute(database)
  return new Map(
    columns.rows.map((row) => [
      `${row.table}.${row.column}`,
      {
        table: row.table,
        column: row.column,
        type: row.type,
        nullable: row.nullable === 'YES',
        hasDefault: row.default !== null
      }
    ])
  )
}

/**
 * What a migration took from code that ran before it: tables and columns dropped or renamed,
 * columns retyped or newly required, and required columns added to tables that existed without
 * a default. A change to a table or `table.column` in `contracts` is allowed.
 */
export function contractions(
  before: Map<string, ColumnShape>,
  after: Map<string, ColumnShape>,
  contracts: readonly string[] = []
): string[] {
  const allowed = (shape: ColumnShape) =>
    contracts.includes(shape.table) || contracts.includes(`${shape.table}.${shape.column}`)
  const tablesBefore = new Set([...before.values()].map((shape) => shape.table))
  const found: string[] = []
  for (const [name, old] of before) {
    if (allowed(old)) continue
    const current = after.get(name)
    if (!current) found.push(`${name} removed`)
    else if (current.type !== old.type)
      found.push(`${name} changed from ${old.type} to ${current.type}`)
    else if (old.nullable && !current.nullable) found.push(`${name} became required`)
    else if (!current.nullable && old.hasDefault && !current.hasDefault) {
      found.push(`${name} lost its default`)
    }
  }
  for (const [name, added] of after) {
    if (before.has(name) || !tablesBefore.has(added.table) || allowed(added)) continue
    if (!added.nullable && !added.hasDefault)
      found.push(`${name} added as required without a default`)
  }
  return found
}
