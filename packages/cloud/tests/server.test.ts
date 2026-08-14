import { describe, expect, test } from 'bun:test'

import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type Dialect,
  type QueryResult
} from 'kysely'

import { CLOUD_PROTOCOL_VERSION } from '../src/contract'
import {
  createCloudApp,
  createCloudAuth,
  parseCloudServerConfig,
  type CloudDatabase
} from '../src/server'

function dummyPostgresDialect(): Dialect {
  return {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (database) => new PostgresIntrospector(database),
    createQueryCompiler: () => new PostgresQueryCompiler()
  }
}

const completed = Promise.resolve()
const noOperation = () => completed

function failingPostgresDialect(): Dialect {
  const dialect = dummyPostgresDialect()
  return {
    ...dialect,
    createDriver: () => ({
      init: noOperation,
      async acquireConnection(): Promise<DatabaseConnection> {
        return {
          executeQuery<R>(_query: CompiledQuery): Promise<QueryResult<R>> {
            return Promise.reject(new Error('database unavailable'))
          },
          streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
            throw new Error('database unavailable')
          }
        }
      },
      beginTransaction: noOperation,
      commitTransaction: noOperation,
      rollbackTransaction: noOperation,
      releaseConnection: noOperation,
      destroy: noOperation
    })
  }
}

const config = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: 'https://pencil.example.com',
  databaseURL: 'postgresql://openpencil:secret@database/openpencil',
  authSecret: 'a-secure-auth-secret-with-at-least-32-characters',
  googleClientId: 'google-client',
  googleClientSecret: 'google-secret',
  s3Endpoint: 'https://objects.example.com',
  s3Region: 'us-east-1',
  s3Bucket: 'openpencil',
  s3AccessKeyId: 'access-key',
  s3SecretAccessKey: 'secret-key'
})

function services() {
  const database = new Kysely<CloudDatabase>({ dialect: dummyPostgresDialect() })
  return {
    config,
    database,
    auth: createCloudAuth(config, database),
    objects: {
      async createUpload() {
        throw new Error('not used')
      },
      async head() {
        return null
      },
      delete: noOperation
    }
  }
}

describe('createCloudApp', () => {
  test('serves a health response without starting a listener', async () => {
    const response = await createCloudApp(services()).request('/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'ok',
      protocolVersion: CLOUD_PROTOCOL_VERSION
    })
  })

  test('derives discovery from validated server capabilities', async () => {
    const response = await createCloudApp(services()).request('/.well-known/openpencil')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      protocolVersion: CLOUD_PROTOCOL_VERSION,
      deployment: 'self-hosted',
      apiURL: 'https://pencil.example.com/api',
      authURL: 'https://pencil.example.com/api/auth',
      authentication: {
        socialProviders: ['google'],
        enterpriseSSO: false
      },
      capabilities: {
        documents: true,
        workspaces: true,
        collaboration: false
      }
    })
  })

  test('reports unavailable readiness when the database cannot execute', async () => {
    const unavailable = services()
    unavailable.database = new Kysely<CloudDatabase>({ dialect: failingPostgresDialect() })
    const response = await createCloudApp(unavailable).request('/ready')
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: 'unavailable' })
  })
})
