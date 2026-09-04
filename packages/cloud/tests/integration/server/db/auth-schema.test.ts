import { describe, expect, test } from 'bun:test'

import { PGlite } from '@electric-sql/pglite'
import { PGliteDialect } from 'kysely-pglite-dialect'

import { createCloudDatabase, migrateCloudDatabase } from '@open-pencil/cloud/server'

async function testDatabase() {
  const pglite = await PGlite.create({ dataDir: 'memory://' })
  return createCloudDatabase({ dialect: new PGliteDialect(pglite) })
}

async function createRequiredAuthSchema(database: Awaited<ReturnType<typeof testDatabase>>) {
  const tables: Array<[string, Array<[string, string]>]> = [
    [
      'user',
      [
        ['id', 'text'],
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
        ['id', 'text'],
        ['expires_at', 'timestamptz'],
        ['token', 'text'],
        ['user_id', 'text'],
        ['impersonated_by', 'text']
      ]
    ],
    [
      'account',
      [
        ['id', 'text'],
        ['issuer', 'text'],
        ['account_id', 'text'],
        ['provider_id', 'text'],
        ['user_id', 'text']
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
        ['id', 'text'],
        ['secret', 'text'],
        ['backup_codes', 'text'],
        ['user_id', 'text'],
        ['verified', 'boolean'],
        ['failed_verification_count', 'integer'],
        ['locked_until', 'timestamptz']
      ]
    ],
    [
      'passkey',
      [
        ['id', 'text'],
        ['public_key', 'text'],
        ['user_id', 'text'],
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
      builder = builder.addColumn(column, type as 'text')
    }
    await builder.execute()
  }
}

describe('Better Auth schema ledger', () => {
  test('bootstraps an empty schema once and records its version', async () => {
    const database = await testDatabase()
    let runs = 0
    const migration = {
      schemaVersion: '1.7.2+mfa.1',
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
        await database.selectFrom('cloudAuthSchema').selectAll().executeTakeFirstOrThrow()
      ).toMatchObject({ id: 'better-auth', version: '1.7.2+mfa.1' })
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
        schemaVersion: '1.7.2+mfa.1',
        run: () => {
          throw new Error('Complete schemas must be adopted')
        }
      })
      expect(
        await database.selectFrom('cloudAuthSchema').select('version').executeTakeFirstOrThrow()
      ).toEqual({ version: '1.7.2+mfa.1' })
    } finally {
      await database.destroy()
    }
  })

  test('rejects partial and unreviewed upgraded schemas', async () => {
    const database = await testDatabase()
    try {
      await migrateCloudDatabase(database)
      await database.schema.createTable('user').addColumn('id', 'text').execute()
      await expect(
        migrateCloudDatabase(database, { schemaVersion: '1.7.2', run: async () => undefined })
      ).rejects.toThrow('Existing Better Auth schema is incomplete')
      await database
        .insertInto('cloudAuthSchema')
        .values({ id: 'better-auth', version: '1.7.2', updatedAt: new Date() })
        .execute()
      await expect(
        migrateCloudDatabase(database, { schemaVersion: '1.8.0', run: async () => undefined })
      ).rejects.toThrow('requires an explicit migration')
    } finally {
      await database.destroy()
    }
  })
})
