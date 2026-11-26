import {
  createBetterAuthAdapter,
  createCloudDatabase,
  migrateCloudDatabase,
  parseCloudServerConfig
} from '#cloud/server'
import { PGlite } from '@electric-sql/pglite'
import { PGliteDialect } from 'kysely-pglite-dialect'

export type CloudTestDatabase = {
  database: ReturnType<typeof createCloudDatabase>
  close(): Promise<void>
}

const testConfig = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: 'http://localhost:8787',
  databaseURL: 'postgresql://test:test@localhost/test',
  authSecret: 'integration-test-secret-at-least-32-characters',
  s3Endpoint: 'http://localhost:9000',
  s3Region: 'us-east-1',
  s3Bucket: 'openpencil',
  s3AccessKeyId: 'openpencil',
  s3SecretAccessKey: 'openpencil-secret'
})

/** A database with every migration applied, saved as an image once per test process. */
async function migratedImage(): Promise<Blob> {
  const pglite = await PGlite.create({ dataDir: 'memory://' })
  const database = createCloudDatabase({ dialect: new PGliteDialect(pglite) })
  try {
    const auth = createBetterAuthAdapter(testConfig, database)
    await migrateCloudDatabase(database, { run: auth.migrate, schemaVersion: auth.schemaVersion })
    return await pglite.dumpDataDir('none')
  } finally {
    await database.destroy()
  }
}

let image: Promise<Blob> | undefined

/**
 * A migrated database of the test's own. Each one starts from the same saved image: creating an
 * empty PGlite database costs several times what loading the image does, once per test.
 */
export async function createCloudTestDatabase(): Promise<CloudTestDatabase> {
  // A failed attempt is forgotten, so the next test tries again rather than failing with it.
  image ??= migratedImage().catch((error: unknown) => {
    image = undefined
    throw error
  })
  const pglite = await PGlite.create({ loadDataDir: await image })
  const database = createCloudDatabase({ dialect: new PGliteDialect(pglite) })
  return {
    database,
    async close() {
      await database.destroy()
    }
  }
}
