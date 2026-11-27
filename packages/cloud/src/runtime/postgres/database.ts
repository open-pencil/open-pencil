import { createCloudDatabase } from '#cloud/server'
import { PostgresDialect } from 'kysely'
import { Pool, type PoolConfig } from 'pg'

import { POSTGRES_CONNECTION_TIMEOUT_MS, POSTGRES_STATEMENT_TIMEOUT_MS } from './timeouts'

export type PostgresCloudDatabaseOptions = {
  connectionString: string
  pool?: Omit<PoolConfig, 'connectionString' | 'statement_timeout' | 'query_timeout'>
  /**
   * How long one statement may run, `POSTGRES_STATEMENT_TIMEOUT_MS` unless set; null for no limit
   * of this server's own, as migrations need and as Hyperdrive takes, which keeps no session
   * settings and ends queries past its own limit. PostgreSQL cancels a statement past it, so its
   * connection is free again for the next query.
   */
  statementTimeoutMs?: number | null
}

export function createPostgresCloudDatabase(options: PostgresCloudDatabaseOptions) {
  const statementTimeoutMs =
    options.statementTimeoutMs === undefined
      ? POSTGRES_STATEMENT_TIMEOUT_MS
      : options.statementTimeoutMs
  return createCloudDatabase({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionTimeoutMillis: POSTGRES_CONNECTION_TIMEOUT_MS,
        ...options.pool,
        ...(statementTimeoutMs === null ? {} : { statement_timeout: statementTimeoutMs }),
        connectionString: options.connectionString
      })
    })
  })
}
