import { readFile } from 'node:fs/promises'

import { CLOUD_SERVICES_JWKS_PATH } from '#cloud/contract'
import {
  ServicesConfigError,
  createServicesApp,
  createServicesDatabase,
  migrateServicesDatabase,
  parseServicesTOML,
  type ServicesEnvironment
} from '#cloud/services'
import { createRemoteJWKSet } from 'jose'
import { PostgresDialect } from 'kysely'
import { Pool } from 'pg'

import { listen } from '../listen'

export type NodeServicesOptions = {
  environment?: ServicesEnvironment
  port?: number
}

export async function startNodeServices(options: NodeServicesOptions = {}) {
  const environment = options.environment ?? process.env
  const path = environment.OPENPENCIL_SERVICES_CONFIG
  if (!path) {
    throw new ServicesConfigError('OPENPENCIL_SERVICES_CONFIG must name a relay TOML file')
  }
  const config = parseServicesTOML(await readFile(path, 'utf8'), environment)
  const database = createServicesDatabase(
    new PostgresDialect({ pool: new Pool({ connectionString: config.databaseURL }) })
  )
  try {
    await migrateServicesDatabase(database)
  } catch (error) {
    await database.destroy()
    throw error
  }
  // Metering outlives its answer; shutdown waits for it so no request goes uncharged.
  const metering = new Set<Promise<unknown>>()
  const app = createServicesApp({
    config,
    database,
    keys: createRemoteJWKSet(new URL(CLOUD_SERVICES_JWKS_PATH, config.cloudURL)),
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
