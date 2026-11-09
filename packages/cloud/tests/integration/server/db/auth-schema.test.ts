import { describe, expect, test } from 'bun:test'

import { createCloudDatabase, migrateCloudDatabase } from '#cloud/server'
import { PGlite } from '@electric-sql/pglite'
import { PGliteDialect } from 'kysely-pglite-dialect'

async function testDatabase() {
  return createCloudDatabase({
    dialect: new PGliteDialect(await PGlite.create({ dataDir: 'memory://' }))
  })
}

describe('Better Auth schema ledger', () => {
  test('builds Better Auth’s schema once and records its version', async () => {
    const database = await testDatabase()
    let runs = 0
    const migration = {
      schemaVersion: '1.7.7+mfa.1',
      async run() {
        runs++
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

  test('stops at a schema built for another Better Auth version', async () => {
    const database = await testDatabase()
    // Better Auth's own migration only matters here for the version it records.
    const nothing = () => Promise.resolve()
    try {
      await migrateCloudDatabase(database, { schemaVersion: '1.7.7+mfa.1', run: nothing })
      await expect(
        migrateCloudDatabase(database, { schemaVersion: '1.8.0+mfa.1', run: nothing })
      ).rejects.toThrow('requires an explicit migration')
    } finally {
      await database.destroy()
    }
  })
})
