import { CamelCasePlugin, Kysely, PostgresDialect, type Dialect } from 'kysely'
import { Pool, type PoolConfig } from 'pg'

import type { CloudDatabase } from './schema'

export type CloudDatabaseOptions =
  | { dialect: Dialect; camelCase?: boolean }
  | {
      connectionString: string
      pool?: Omit<PoolConfig, 'connectionString'>
      camelCase?: boolean
    }

export function createCloudDatabase(options: CloudDatabaseOptions): Kysely<CloudDatabase> {
  const dialect =
    'dialect' in options
      ? options.dialect
      : new PostgresDialect({
          pool: new Pool({
            ...options.pool,
            connectionString: options.connectionString
          })
        })
  return new Kysely<CloudDatabase>({
    dialect,
    plugins: options.camelCase === false ? [] : [new CamelCasePlugin()]
  })
}
