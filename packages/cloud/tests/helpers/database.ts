import { PGlite } from '@electric-sql/pglite'
import { PGliteDialect } from 'kysely-pglite-dialect'

import {
  createBetterAuthAdapter,
  createCloudDatabase,
  migrateCloudDatabase,
  parseCloudServerConfig
} from '@open-pencil/cloud/server'

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

export async function createCloudTestDatabase(): Promise<CloudTestDatabase> {
  const pglite = await PGlite.create({ dataDir: 'memory://' })
  const database = createCloudDatabase({
    dialect: new PGliteDialect(pglite)
  })
  const auth = createBetterAuthAdapter(testConfig, database)
  await migrateCloudDatabase(database, auth.migrate)
  return {
    database,
    async close() {
      await database.destroy()
    }
  }
}
