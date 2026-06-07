import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'

import * as schema from './schema.js'

export const DEFAULT_INKLY_API_DB_PATH = fileURLToPath(
  new URL('../../../../.context/api-data/inkly.db', import.meta.url)
)

export type ApiDatabaseMode = 'file' | 'memory' | 'remote'

export interface ApiDatabaseOptions {
  /**
   * - file: local SQLite file (default for development)
   * - memory: in-memory SQLite (for tests)
   * - remote: Turso libSQL (production), requires url + authToken
   */
  mode?: ApiDatabaseMode
  path?: string
  url?: string
  authToken?: string
}

export interface ApiDatabaseEnv {
  INKLY_API_DB_MODE?: string
  INKLY_API_DB_PATH?: string
  TURSO_DATABASE_URL?: string
  TURSO_AUTH_TOKEN?: string
}

export interface ApiDatabase {
  client: Client
  db: LibSQLDatabase<typeof schema>
  mode: ApiDatabaseMode
  /** Resolved local file path for file mode, libsql url for remote mode, ':memory:' otherwise */
  path: string
  close(): void
}

/**
 * Resolve database options from environment variables.
 *
 * Selection order:
 * 1. TURSO_DATABASE_URL set → remote mode (libSQL over HTTPS, with optional TURSO_AUTH_TOKEN)
 * 2. INKLY_API_DB_MODE=memory → memory mode
 * 3. Otherwise → file mode at INKLY_API_DB_PATH or DEFAULT_INKLY_API_DB_PATH
 */
export function resolveApiDatabaseOptions(
  env: ApiDatabaseEnv | NodeJS.ProcessEnv = process.env
): Required<Pick<ApiDatabaseOptions, 'mode' | 'path'>> & {
  url: string
  authToken: string
} {
  const tursoUrl = env.TURSO_DATABASE_URL?.trim() ?? ''
  const tursoToken = env.TURSO_AUTH_TOKEN?.trim() ?? ''

  if (tursoUrl.length > 0) {
    return {
      mode: 'remote',
      path: tursoUrl,
      url: tursoUrl,
      authToken: tursoToken
    }
  }

  if (env.INKLY_API_DB_MODE === 'memory') {
    return {
      mode: 'memory',
      path: ':memory:',
      url: '',
      authToken: ''
    }
  }

  return {
    mode: 'file',
    path: env.INKLY_API_DB_PATH?.trim() || DEFAULT_INKLY_API_DB_PATH,
    url: '',
    authToken: ''
  }
}

export function createApiDatabase(options: ApiDatabaseOptions = {}): ApiDatabase {
  const mode = options.mode ?? 'file'

  let client: Client
  let resolvedPath: string
  let cleanupPath: string | null = null

  if (mode === 'remote') {
    const url = options.url?.trim() ?? ''
    if (!url) {
      throw new Error('createApiDatabase: remote mode requires options.url')
    }
    client = createClient({
      url,
      authToken: options.authToken
    })
    resolvedPath = url
  } else if (mode === 'memory') {
    const filename = resolve(tmpdir(), `inkly-api-memory-${crypto.randomUUID()}.db`)
    client = createClient({ url: `file:${filename}` })
    resolvedPath = ':memory:'
    cleanupPath = filename
  } else {
    const filename = resolve(options.path ?? DEFAULT_INKLY_API_DB_PATH)
    mkdirSync(dirname(filename), { recursive: true })
    client = createClient({ url: `file:${filename}` })
    resolvedPath = filename
  }

  client.executeMultiple('PRAGMA foreign_keys = ON;').catch(() => {})
  if (mode === 'file') {
    client.executeMultiple('PRAGMA journal_mode = WAL;').catch(() => {})
  }

  return {
    client,
    db: drizzle(client, { schema }),
    mode,
    path: resolvedPath,
    close() {
      client.close()
      if (cleanupPath) {
        rmSync(cleanupPath, { force: true })
      }
    }
  }
}
