import { createCloudDatabase } from '#cloud/server'
import { PostgresDialect } from 'kysely'
import { Pool, type PoolConfig } from 'pg'

export type PostgresCloudDatabaseOptions = {
  connectionString: string
  pool?: Omit<PoolConfig, 'connectionString'>
}

export function createPostgresCloudDatabase(options: PostgresCloudDatabaseOptions) {
  return createCloudDatabase({
    dialect: new PostgresDialect({
      pool: new Pool({
        ...options.pool,
        connectionString: options.connectionString
      })
    })
  })
}
