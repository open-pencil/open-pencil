import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Database } from 'bun:sqlite'
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'

import * as schema from './schema.js'

export const DEFAULT_INKLY_API_DB_PATH = fileURLToPath(
  new URL('../../../../.context/api-data/inkly.db', import.meta.url)
)

export type ApiDatabaseMode = 'file' | 'memory'

export interface ApiDatabaseOptions {
  mode?: ApiDatabaseMode
  path?: string
}

export interface ApiDatabaseEnv {
  INKLY_API_DB_MODE?: string
  INKLY_API_DB_PATH?: string
}

export interface ApiDatabase {
  sqlite: Database
  db: BunSQLiteDatabase<typeof schema>
  mode: ApiDatabaseMode
  path: string
  close(): void
}

export function resolveApiDatabaseOptions(
  env: ApiDatabaseEnv | NodeJS.ProcessEnv = process.env
): Required<ApiDatabaseOptions> {
  return {
    mode: env.INKLY_API_DB_MODE === 'memory' ? 'memory' : 'file',
    path: env.INKLY_API_DB_PATH?.trim() || DEFAULT_INKLY_API_DB_PATH
  }
}

export function createApiDatabase(options: ApiDatabaseOptions = {}): ApiDatabase {
  const mode = options.mode ?? 'file'
  const path = options.path ?? DEFAULT_INKLY_API_DB_PATH
  const filename = mode === 'memory' ? ':memory:' : resolve(path)

  if (mode === 'file') {
    mkdirSync(dirname(filename), { recursive: true })
  }

  const sqlite = new Database(filename)
  sqlite.exec('PRAGMA foreign_keys = ON;')

  if (mode === 'file') {
    sqlite.exec('PRAGMA journal_mode = WAL;')
  }

  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
    mode,
    path: filename,
    close() {
      sqlite.close()
    }
  }
}
