import { describe, expect, test } from 'bun:test'

import { followsConvention, ownedNames } from '#cloud-tests/helpers/schema'
import { createServicesDatabase, migrateServicesDatabase } from '#cloud/services'
import { PGlite } from '@electric-sql/pglite'
import { PGliteDialect } from 'kysely-pglite-dialect'

describe('services migrations', () => {
  test('name the services server’s keys and indexes as Cloud’s are', async () => {
    const database = createServicesDatabase(
      new PGliteDialect(await PGlite.create({ dataDir: 'memory://' }))
    )
    try {
      await migrateServicesDatabase(database)
      const entries = await ownedNames(database)
      expect(entries.filter((entry) => !followsConvention(entry))).toEqual([])
      expect(entries.map((entry) => entry.name).toSorted()).toEqual([
        'services_usage_account_id_created_at_idx',
        'services_usage_pkey',
        'services_usage_pkey',
        'services_usage_workspace_id_created_at_id_idx'
      ])
    } finally {
      await database.destroy()
    }
  })
})
