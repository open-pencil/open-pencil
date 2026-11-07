import { createCloudDatabase } from '#cloud/server'
import { PostgresDialect } from 'kysely'
import { Pool, type PoolConfig } from 'pg'

/**
 * How long a query serving a request may take before it fails. Rate limits and sessions live in
 * PostgreSQL, so one stuck query would otherwise hold up every request waiting on the pool.
 */
export const POSTGRES_QUERY_TIMEOUT_MS = 30_000

export type PostgresCloudDatabaseOptions = {
  connectionString: string
  pool?: Omit<PoolConfig, 'connectionString'>
  /**
   * How long one query may take, `POSTGRES_QUERY_TIMEOUT_MS` unless set; null for no limit, as
   * migrations need. Enforced by the client, since a pooler such as Hyperdrive may not pass on
   * session settings.
   */
  queryTimeoutMs?: number | null
}

export function createPostgresCloudDatabase(options: PostgresCloudDatabaseOptions) {
  const queryTimeoutMs =
    options.queryTimeoutMs === undefined ? POSTGRES_QUERY_TIMEOUT_MS : options.queryTimeoutMs
  return createCloudDatabase({
    dialect: new PostgresDialect({
      pool: new Pool({
        ...(queryTimeoutMs === null ? {} : { query_timeout: queryTimeoutMs }),
        ...options.pool,
        connectionString: options.connectionString
      })
    })
  })
}
