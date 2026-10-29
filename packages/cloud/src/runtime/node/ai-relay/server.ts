import { readFile } from 'node:fs/promises'

import {
  AIRelayConfigError,
  createAIRelayApp,
  createAIRelayDatabase,
  migrateAIRelayDatabase,
  parseAIRelayTOML,
  type AIRelayEnvironment
} from '#cloud/ai-relay'
import { CLOUD_AI_JWKS_PATH } from '#cloud/contract'
import { createRemoteJWKSet } from 'jose'
import { PostgresDialect } from 'kysely'
import { Pool } from 'pg'

import { listen } from '../listen'

export type NodeAIRelayOptions = {
  environment?: AIRelayEnvironment
  port?: number
}

export async function startNodeAIRelay(options: NodeAIRelayOptions = {}) {
  const environment = options.environment ?? process.env
  const path = environment.OPENPENCIL_AI_RELAY_CONFIG
  if (!path) {
    throw new AIRelayConfigError('OPENPENCIL_AI_RELAY_CONFIG must name a relay TOML file')
  }
  const config = parseAIRelayTOML(await readFile(path, 'utf8'), environment)
  const database = createAIRelayDatabase(
    new PostgresDialect({ pool: new Pool({ connectionString: config.databaseURL }) })
  )
  try {
    await migrateAIRelayDatabase(database)
  } catch (error) {
    await database.destroy()
    throw error
  }
  // Metering outlives its answer; shutdown waits for it so no request goes uncharged.
  const metering = new Set<Promise<unknown>>()
  const app = createAIRelayApp({
    config,
    database,
    keys: createRemoteJWKSet(new URL(CLOUD_AI_JWKS_PATH, config.cloudURL)),
    waitUntil: (promise) => {
      metering.add(promise)
      void promise.finally(() => metering.delete(promise))
    }
  })
  const server = await listen(
    async (request) => app.fetch(request),
    options.port ?? Number(environment.PORT ?? 8788),
    environment.HOST ?? '0.0.0.0'
  )
  return {
    url: server.url,
    async stop() {
      await server.close()
      await Promise.allSettled(metering)
      await database.destroy()
    }
  }
}
