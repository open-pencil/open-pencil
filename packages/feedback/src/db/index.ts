import type { D1Database } from '@cloudflare/workers-types/index'
import { CamelCasePlugin, Kysely, type CompiledQuery } from 'kysely'
import { D1Dialect } from 'kysely-d1'

import type { FeedbackDatabase } from './tables'

export type { FeedbackDatabase } from './tables'

export function createFeedbackDatabase(database: D1Database): Kysely<FeedbackDatabase> {
  return new Kysely<FeedbackDatabase>({
    dialect: new D1Dialect({ database }),
    plugins: [new CamelCasePlugin()]
  })
}

/** Runs Kysely-built statements as one D1 batch, which is atomic. */
export async function runBatch(d1: D1Database, statements: CompiledQuery[]): Promise<void> {
  if (!statements.length) return
  await d1.batch(statements.map((query) => d1.prepare(query.sql).bind(...query.parameters)))
}
