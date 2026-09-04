import type { Dialect } from 'kysely'
import { CamelCasePlugin, Kysely } from 'kysely'

import type { CloudDatabase } from './schema'

export type CloudDatabaseOptions = {
  dialect: Dialect
}

export function createCloudDatabase(options: CloudDatabaseOptions): Kysely<CloudDatabase> {
  return new Kysely<CloudDatabase>({
    dialect: options.dialect,
    plugins: [new CamelCasePlugin()]
  })
}
