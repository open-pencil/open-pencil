import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'
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

import { CLOUD_PROTOCOL_VERSION } from '@open-pencil/cloud/contract'
import {
  createCloudApp,
  createBetterAuthAdapter,
  parseCloudServerConfig,
  type CloudDatabase
} from '@open-pencil/cloud/server'

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
  trustedOrigins: ['https://app.example.com'],
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
    auth: createBetterAuthAdapter(config, database),
    objects: {
      capabilities: {
        nativeSHA256: true,
        multipartUpload: false,
        conditionalWrites: false
      },
      async checkReadiness() {
        return { ok: true, checksumVerification: 'native' as const }
      },
      async createDownload() {
        throw new Error('not used')
      },
      async createUpload() {
        throw new Error('not used')
      },
      completeUpload: noOperation,
      abortUpload: noOperation,
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
        collaboration: true
      }
    })
  })

  test('allows credentialed CORS for trusted origins only', async () => {
    const cloud = createCloudApp(services())
    const trustedDiscovery = await cloud.request('/.well-known/openpencil', {
      headers: { Origin: 'https://app.example.com' }
    })
    expect(trustedDiscovery.headers.get('access-control-allow-origin')).toBe(
      'https://app.example.com'
    )

    const trusted = await createCloudApp(services()).request('/api/session', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.example.com',
        'Access-Control-Request-Method': 'GET'
      }
    })
    expect(trusted.status).toBe(204)
    expect(trusted.headers.get('access-control-allow-origin')).toBe('https://app.example.com')
    expect(trusted.headers.get('access-control-allow-credentials')).toBe('true')

    const untrusted = await createCloudApp(services()).request('/api/session', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://malicious.example.com',
        'Access-Control-Request-Method': 'GET'
      }
    })
    expect(untrusted.headers.get('access-control-allow-origin')).toBeNull()
  })

  test('reports object storage capabilities when ready', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const available = services()
      available.database = runtime.database
      const response = await createCloudApp(available).request('/ready')
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        status: 'ready',
        objectStorage: { checksumVerification: 'native', multipartUpload: false }
      })
    } finally {
      await runtime.close()
    }
  })

  test('reports unavailable readiness when the database cannot execute', async () => {
    const unavailable = services()
    unavailable.database = new Kysely<CloudDatabase>({ dialect: failingPostgresDialect() })
    const response = await createCloudApp(unavailable).request('/ready')
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: 'unavailable' })
  })
})
