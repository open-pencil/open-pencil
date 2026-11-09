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
