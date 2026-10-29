import { describe, expect, test } from 'bun:test'

import { createCloudDatabase, migrateCloudDatabase } from '#cloud/server'
import { up as relaxAccountIssuer } from '#cloud/server/db/migrations/019_better_auth_account_issuer'
import {
  down as restoreTableNames,
  up as renameTables
} from '#cloud/server/db/migrations/025_table_names'
import type { LegacyAuthSchemaDatabase } from '#cloud/server/db/migrations/helpers'
import { PGlite } from '@electric-sql/pglite'
import { CamelCasePlugin, Kysely, sql } from 'kysely'
import { PGliteDialect } from 'kysely-pglite-dialect'

async function testDatabase(pglite?: PGlite) {
  const store = pglite ?? (await PGlite.create({ dataDir: 'memory://' }))
  return createCloudDatabase({ dialect: new PGliteDialect(store) })
}

async function createRequiredAuthSchema(database: Awaited<ReturnType<typeof testDatabase>>) {
  const tables: Array<[string, Array<[string, string]>]> = [
    [
      'user',
      [
        ['id', 'uuid'],
        ['name', 'text'],
        ['email', 'text'],
        ['email_verified', 'boolean'],
        ['created_at', 'timestamptz'],
        ['updated_at', 'timestamptz'],
        ['role', 'text'],
        ['banned', 'boolean'],
        ['two_factor_enabled', 'boolean']
      ]
    ],
    [
      'session',
      [
        ['id', 'uuid'],
        ['expires_at', 'timestamptz'],
        ['token', 'text'],
        ['user_id', 'uuid'],
        ['impersonated_by', 'text']
      ]
    ],
    [
      'account',
      [
        ['id', 'uuid'],
        ['account_id', 'text'],
        ['provider_id', 'text'],
        ['user_id', 'uuid']
      ]
    ],
    [
      'verification',
      [
        ['id', 'text'],
        ['identifier', 'text'],
        ['value', 'text'],
        ['expires_at', 'timestamptz']
      ]
    ],
    [
      'device_code',
      [
        ['id', 'text'],
        ['device_code', 'text'],
        ['user_code', 'text'],
        ['status', 'text'],
        ['client_id', 'text']
      ]
    ],
    [
      'two_factor',
      [
        ['id', 'uuid'],
        ['secret', 'text'],
        ['backup_codes', 'text'],
        ['user_id', 'uuid'],
        ['verified', 'boolean'],
        ['failed_verification_count', 'integer'],
        ['locked_until', 'timestamptz']
      ]
    ],
    [
      'passkey',
      [
        ['id', 'uuid'],
        ['public_key', 'text'],
        ['user_id', 'uuid'],
        ['credential_id', 'text'],
        ['counter', 'integer'],
        ['device_type', 'text'],
        ['backed_up', 'boolean']
      ]
    ],
    [
      'rate_limit',
      [
        ['id', 'text'],
        ['key', 'text'],
        ['count', 'integer'],
        ['last_request', 'bigint']
      ]
    ]
  ]
  for (const [table, columns] of tables) {
    let builder = database.schema.createTable(table)
    for (const [column, type] of columns) {
      builder = builder.addColumn(column, type as 'text' | 'uuid')
    }
    await builder.execute()
  }
}

describe('Better Auth schema ledger', () => {
  test('bootstraps an empty schema once and records its version', async () => {
    const database = await testDatabase()
    let runs = 0
    const migration = {
      schemaVersion: '1.7.7+mfa.1',
      async run() {
        runs++
        await createRequiredAuthSchema(database)
      }
    }
    try {
      await migrateCloudDatabase(database, migration)
      await migrateCloudDatabase(database, migration)
      expect(runs).toBe(1)
      expect(
        await database.selectFrom('authSchemaVersion').selectAll().executeTakeFirstOrThrow()
      ).toMatchObject({ id: 'better-auth', version: '1.7.7+mfa.1' })
    } finally {
      await database.destroy()
    }
  })

  test('adopts a complete pre-ledger schema without rerunning Better Auth', async () => {
    const database = await testDatabase()
    try {
      await migrateCloudDatabase(database)
      await createRequiredAuthSchema(database)
      await migrateCloudDatabase(database, {
        schemaVersion: '1.7.7+mfa.1',
        run: () => {
          throw new Error('Complete schemas must be adopted')
        }
      })
      expect(
        await database.selectFrom('authSchemaVersion').select('version').executeTakeFirstOrThrow()
      ).toEqual({ version: '1.7.7+mfa.1' })
    } finally {
      await database.destroy()
    }
  })

  test('rejects partial and unreviewed upgraded schemas', async () => {
    const database = await testDatabase()
    try {
      await migrateCloudDatabase(database)
      await database.schema.createTable('user').addColumn('id', 'uuid').execute()
      await expect(
        migrateCloudDatabase(database, { schemaVersion: '1.7.2', run: async () => undefined })
      ).rejects.toThrow('Existing Better Auth schema is incomplete')
      await database
        .insertInto('authSchemaVersion')
        .values({ id: 'better-auth', version: '1.7.2', updatedAt: new Date() })
        .execute()
      await expect(
        migrateCloudDatabase(database, { schemaVersion: '1.8.0', run: async () => undefined })
      ).rejects.toThrow('requires an explicit migration')
    } finally {
      await database.destroy()
    }
  })

  test('lets a schema from Better Auth 1.7.2 create accounts without an issuer', async () => {
    const pglite = await PGlite.create({ dataDir: 'memory://' })
    const database = await testDatabase(pglite)
    // Migrations run untyped, the way the migrator calls them, with the database's plugins.
    const untyped = new Kysely<unknown>({
      dialect: new PGliteDialect(pglite),
      plugins: [new CamelCasePlugin()]
    })
    try {
      await migrateCloudDatabase(database)
      // The schema as 019 found it, before the tables lost their `cloud_` prefix.
      await restoreTableNames(untyped)
      const legacy = untyped as Kysely<LegacyAuthSchemaDatabase>
      await database.schema
        .createTable('account')
        .addColumn('id', 'uuid', (column) => column.primaryKey())
        .addColumn('issuer', 'text', (column) => column.notNull())
        .addColumn('account_id', 'text', (column) => column.notNull())
        .addColumn('provider_id', 'text', (column) => column.notNull())
        .execute()
      await database.schema
        .createIndex('account_issuer_accountId_uidx')
        .on('account')
        .columns(['issuer', 'account_id'])
        .unique()
        .execute()
      await legacy
        .insertInto('cloudAuthSchema')
        .values({ id: 'better-auth', version: '1.7.2+mfa.1', updatedAt: new Date() })
        .execute()

      await relaxAccountIssuer(untyped)
      await renameTables(untyped)

      expect(
        await database.selectFrom('authSchemaVersion').select('version').executeTakeFirstOrThrow()
      ).toEqual({ version: '1.7.7+mfa.1' })
      const account = (await database.introspection.getTables()).find(
        (table) => table.name === 'account'
      )
      expect(account?.columns.find((column) => column.name === 'issuer')?.isNullable).toBe(true)
      const indexes = await sql<{ indexname: string }>`
        select indexname from pg_indexes where tablename = 'account'
      `.execute(database)
      expect(indexes.rows.map((row) => row.indexname)).not.toContain(
        'account_issuer_accountId_uidx'
      )
    } finally {
      await database.destroy()
    }
  })
})
