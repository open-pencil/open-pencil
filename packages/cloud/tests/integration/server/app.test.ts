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
  createEnrollmentService,
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
  test('materializes enrollment from an authenticated identity and protects admin routes', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const approvalConfig = parseCloudServerConfig({ ...config, enrollmentMode: 'approval' })
      const app = createCloudApp({
        ...services(),
        config: approvalConfig,
        database: runtime.database,
        auth: createBetterAuthAdapter(approvalConfig, runtime.database),
        resolveIdentity: async () => ({
          userId: 'pending-user',
          email: 'pending@example.com',
          name: 'Pending User'
        })
      })
      expect((await app.request('/api/enrollment/request', { method: 'POST' })).status).toBe(401)
      expect(await (await app.request('/api/account/status')).json()).toEqual({
        user: {
          userId: 'pending-user',
          email: 'pending@example.com',
          name: 'Pending User'
        },
        state: 'pending'
      })
      expect(
        await runtime.database
          .selectFrom('cloudEnrollment')
          .select(['emailNormalized', 'status'])
          .executeTakeFirstOrThrow()
      ).toEqual({ emailNormalized: 'pending@example.com', status: 'pending' })
      expect((await app.request('/api/admin/enrollments')).status).toBe(401)
    } finally {
      await runtime.close()
    }
  })

  test('allows only deployment administrators to use admin routes', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const adminApp = createCloudApp({
        ...services(),
        database: runtime.database,
        auth: createBetterAuthAdapter(config, runtime.database),
        resolveSession: async () => ({
          userId: 'admin-user',
          email: 'admin@example.com',
          name: 'Admin',
          deploymentRole: 'admin'
        })
      })
      const userApp = createCloudApp({
        ...services(),
        database: runtime.database,
        auth: createBetterAuthAdapter(config, runtime.database),
        resolveSession: async () => ({
          userId: 'ordinary-user',
          email: 'user@example.com',
          name: 'User',
          deploymentRole: 'user'
        })
      })
      expect(
        (
          await userApp.request('/api/admin/operations', {
            headers: { Origin: 'https://pencil.example.com' }
          })
        ).status
      ).toBe(403)
      expect(
        (
          await adminApp.request('/api/admin/enrollments/missing/approve', {
            method: 'POST',
            headers: {
              Origin: 'https://untrusted.example.com',
              'Content-Type': 'application/json'
            },
            body: '{}'
          })
        ).status
      ).toBe(403)
      const response = await adminApp.request('/api/admin/operations')
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        enrollmentMode: 'open',
        pendingEnrollment: 0
      })
    } finally {
      await runtime.close()
    }
  })

  test('exposes restricted account state without authorizing product APIs', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const approvalConfig = parseCloudServerConfig({ ...config, enrollmentMode: 'approval' })
      const pendingIdentity = {
        userId: 'pending-user',
        email: 'pending@example.com',
        name: 'Pending User',
        deploymentRole: 'user' as const
      }
      const app = createCloudApp({
        ...services(),
        config: approvalConfig,
        database: runtime.database,
        auth: createBetterAuthAdapter(approvalConfig, runtime.database),
        resolveIdentity: async () => pendingIdentity,
        resolveSession: async () => null
      })
      await createEnrollmentService(runtime.database).request({
        email: pendingIdentity.email,
        name: pendingIdentity.name
      })

      expect(await (await app.request('/api/account/status')).json()).toEqual({
        user: pendingIdentity,
        state: 'pending'
      })
      expect((await app.request('/api/session')).status).toBe(401)
      expect((await app.request('/api/admin/enrollments')).status).toBe(401)
    } finally {
      await runtime.close()
    }
  })

  test('keeps Better Auth routes outside the OpenPencil rate limiter', async () => {
    const runtime = await createCloudTestDatabase()
    let authCalls = 0
    try {
      const base = services()
      const app = createCloudApp({
        ...base,
        database: runtime.database,
        auth: {
          ...base.auth,
          async handler() {
            authCalls++
            return Response.json({ ok: true })
          }
        }
      })
      for (let index = 0; index < 8; index++) {
        expect((await app.request('/api/auth/test', { method: 'POST' })).status).toBe(200)
      }
      expect(authCalls).toBe(8)
      expect(
        await runtime.database
          .selectFrom('cloudRateLimit')
          .select(({ fn }) => fn.countAll<number>().as('count'))
          .executeTakeFirstOrThrow()
      ).toEqual({ count: 0 })
    } finally {
      await runtime.close()
    }
  })

  test('serves indexing policy through robots and response headers', async () => {
    const denied = createCloudApp(services())
    const robots = await denied.request('/robots.txt')
    expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n')
    expect((await denied.request('/health')).headers.get('X-Robots-Tag')).toBe(
      'noindex, nofollow, noarchive'
    )

    const allowedServices = services()
    allowedServices.config = { ...allowedServices.config, indexingPolicy: 'allow' }
    const allowed = createCloudApp(allowedServices)
    expect(await (await allowed.request('/robots.txt')).text()).toContain('Disallow: /admin')
    expect((await allowed.request('/health')).headers.get('X-Robots-Tag')).toBeNull()
    expect((await allowed.request('/api/session')).headers.get('X-Robots-Tag')).toBe(
      'noindex, nofollow, noarchive'
    )
  })

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
      appURL: 'https://pencil.example.com',
      authentication: {
        socialProviders: ['google'],
        enterpriseSSO: false,
        enrollmentMode: 'open'
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
