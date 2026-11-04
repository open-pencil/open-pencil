import { createBetterAuthAdapter, type CloudDatabase, type CloudServerConfig } from '#cloud/server'
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler
} from 'kysely'

/**
 * An auth adapter for apps whose tests resolve sessions themselves. Better Auth checks its schema
 * in the background once created, so an adapter on the test database can still be querying it
 * when a short test closes it; this one queries a database that answers nothing.
 */
export function unusedAuthAdapter(config: CloudServerConfig) {
  const database = new Kysely<CloudDatabase>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler()
    }
  })
  return createBetterAuthAdapter(config, database)
}
