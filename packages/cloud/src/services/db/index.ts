import { CamelCasePlugin, Kysely, type Dialect } from 'kysely'

import type { ServicesDatabase } from './schema'

export { migrateServicesDatabase } from './migrate'
export type { ServicesDatabase, ServicesUsage, NewServicesUsage } from './schema'

export function createServicesDatabase(dialect: Dialect): Kysely<ServicesDatabase> {
  return new Kysely<ServicesDatabase>({ dialect, plugins: [new CamelCasePlugin()] })
}
