import { createMockEmailSender } from '../../packages/api/src/email/mock.js'
import type { InklyAuth } from '../../packages/api/src/auth/index.js'
import type { ApiDatabase } from '../../packages/api/src/db/client.js'
import { createMigratedApiDatabase } from '../../packages/api/src/db/migrate.js'
import {
  createApiApp,
  type CreateApiAppOptions
} from '../../packages/api/src/server.js'

export const TEST_API_SECRET = 'test-secret'

export function createTestApiDatabase(): ApiDatabase {
  return createMigratedApiDatabase({ mode: 'memory' })
}

export function createTestApiApp(options: Partial<CreateApiAppOptions> = {}) {
  const database = options.database ?? createTestApiDatabase()
  const email = createMockEmailSender()
  const auth = options.auth as InklyAuth | undefined
  const appBundle = createApiApp({
    secret: options.secret ?? TEST_API_SECRET,
    database,
    auth,
    emailSender: options.emailSender ?? email.sender,
    now: options.now,
    store: options.store,
    boardStore: options.boardStore,
    env: options.env
  })

  return {
    ...appBundle,
    database,
    email
  }
}
