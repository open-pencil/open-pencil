import { CamelCasePlugin, Kysely, type Dialect } from 'kysely'

import type { AIRelayDatabase } from './schema'

export { migrateAIRelayDatabase } from './migrate'
export type { AIRelayDatabase, AIRelayUsage, NewAIRelayUsage } from './schema'

export function createAIRelayDatabase(dialect: Dialect): Kysely<AIRelayDatabase> {
  return new Kysely<AIRelayDatabase>({ dialect, plugins: [new CamelCasePlugin()] })
}
