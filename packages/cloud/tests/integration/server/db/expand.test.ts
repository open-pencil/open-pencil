import { describe, expect, test } from 'bun:test'

import { columnShapes, contractions } from '#cloud-tests/helpers/schema'
import { CloudMigrationProvider, type CloudMigration } from '#cloud/server/db/migrate'
import { SERVICES_MIGRATION_TABLES, ServicesMigrationProvider } from '#cloud/services/db/migrate'
import { PGlite } from '@electric-sql/pglite'
import { Kysely } from 'kysely'
import { PGliteDialect } from 'kysely-pglite-dialect'
import { Migrator } from 'kysely/migration'

/**
 * Applies each migration in turn and lists what it took from the schema the previous release ran
 * on, which keeps serving until the new code replaces it.
 */
async function contractionsByMigration(
  provider: { getMigrations(): Promise<Record<string, CloudMigration>> },
  tables: Partial<typeof SERVICES_MIGRATION_TABLES> = {}
): Promise<Record<string, string[]>> {
  const database = new Kysely<unknown>({
    dialect: new PGliteDialect(await PGlite.create({ dataDir: 'memory://' }))
  })
  try {
    const migrator = new Migrator({ db: database, provider, ...tables })
    const found: Record<string, string[]> = {}
    for (const [name, migration] of Object.entries(await provider.getMigrations())) {
      const before = await columnShapes(database)
      const result = await migrator.migrateTo(name)
      expect(result.error).toBeUndefined()
      const taken = contractions(before, await columnShapes(database), migration.contracts)
      if (taken.length > 0) found[name] = taken
    }
    return found
  } finally {
    await database.destroy()
  }
}

describe('expand-only migrations', () => {
  test('Cloud’s migrations leave the previous release’s tables and columns usable', async () => {
    expect(await contractionsByMigration(new CloudMigrationProvider())).toEqual({})
  })

  test('the services server’s migrations leave its previous release’s columns usable', async () => {
    expect(
      await contractionsByMigration(new ServicesMigrationProvider(), SERVICES_MIGRATION_TABLES)
    ).toEqual({})
  })
})

describe('contractions', () => {
  const column = (
    table: string,
    name: string,
    shape: Partial<{ type: string; nullable: boolean; hasDefault: boolean }> = {}
  ) =>
    [
      `${table}.${name}`,
      { table, column: name, type: 'text', nullable: true, hasDefault: false, ...shape }
    ] as const

  test('finds what old code would trip on', () => {
    const before = new Map([
      column('document', 'name'),
      column('document', 'size', { type: 'integer' }),
      column('document', 'note'),
      column('document', 'kind', { nullable: false, hasDefault: true }),
      column('share', 'id')
    ])
    const after = new Map([
      column('document', 'size', { type: 'bigint' }),
      column('document', 'note', { nullable: false }),
      column('document', 'kind', { nullable: false }),
      column('document', 'owner', { nullable: false }),
      column('document', 'flag', { nullable: false, hasDefault: true }),
      column('report', 'reason', { nullable: false })
    ])
    expect(contractions(before, after)).toEqual([
      'document.name removed',
      'document.size changed from integer to bigint',
      'document.note became required',
      'document.kind lost its default',
      'share.id removed',
      'document.owner added as required without a default'
    ])
  })

  test('lets a table it contracts lose columns, but not gain required ones', () => {
    const before = new Map([column('document', 'name'), column('document', 'note')])
    const after = new Map([column('document', 'owner', { nullable: false })])
    expect(contractions(before, after, ['document'])).toEqual([
      'document.owner added as required without a default'
    ])
  })

  test('allows what a migration declares it contracts', () => {
    const before = new Map([column('document', 'name'), column('share', 'id')])
    expect(contractions(before, new Map(), ['document.name', 'share'])).toEqual([])
  })
})
