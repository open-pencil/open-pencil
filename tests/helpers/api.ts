import type { InklyAuth } from '../../packages/api/src/auth/index.js'
import type { ApiDatabase } from '../../packages/api/src/db/client.js'
import { createMigratedApiDatabase } from '../../packages/api/src/db/migrate.js'
import { createApiApp, type CreateApiAppOptions } from '../../packages/api/src/server.js'

export const TEST_API_SECRET = 'test-secret'

export async function createTestApiDatabase(): Promise<ApiDatabase> {
  return await createMigratedApiDatabase({ mode: 'memory' })
}

export async function createTestApiApp(options: Partial<CreateApiAppOptions> = {}) {
  const database = options.database ?? (await createTestApiDatabase())
  const auth = options.auth as InklyAuth | undefined
  const appBundle = await createApiApp({
    secret: options.secret ?? TEST_API_SECRET,
    database,
    auth,
    now: options.now,
    store: options.store,
    boardStore: options.boardStore,
    teamStore: options.teamStore,
    notificationStore: options.notificationStore,
    env: options.env
  })

  return {
    ...appBundle,
    database
  }
}
