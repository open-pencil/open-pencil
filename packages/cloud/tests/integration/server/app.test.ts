import { describe, expect, test } from 'bun:test'

import { adminContractClient, contractClient, outcome } from '#cloud-tests/helpers/contract'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { CLOUD_PROTOCOL_VERSION } from '#cloud/contract'
import {
  createCloudApp,
  createBetterAuthAdapter,
  createEnrollmentService,
  parseCloudServerConfig,
  type CloudDatabase
} from '#cloud/server'
import { testClient } from 'hono/testing'
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
      delete: noOperation,
      async write() {
        throw new Error('not used')
      },
      async read() {
        return null
      },
      async readRange() {
        return null
      }
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
      const client = testClient(app)
      // No such route: the API answers unauthenticated callers before routing.
      expect((await app.request('/api/enrollment/request', { method: 'POST' })).status).toBe(401)
      expect(await (await client.api.account.status.$get()).json()).toEqual({
        user: {
          userId: 'pending-user',
          email: 'pending@example.com',
          name: 'Pending User'
        },
        state: 'pending'
      })
      expect(
        await runtime.database
          .selectFrom('enrollment')
          .select(['emailNormalized', 'status'])
          .executeTakeFirstOrThrow()
      ).toEqual({ emailNormalized: 'pending@example.com', status: 'pending' })
      expect(await outcome(adminContractClient(app).enrollments({ query: {} }))).toMatchObject({
        status: 401
      })
    } finally {
      await runtime.close()
    }
  })

  test('requires MFA assurance only for deployment administration', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const enforcedConfig = parseCloudServerConfig({
        ...config,
        deploymentAdminMFARequired: true,
        totpEnabled: true
      })
      const auth = createBetterAuthAdapter(enforcedConfig, runtime.database)
      const app = createCloudApp({
        ...services(),
        config: enforcedConfig,
        database: runtime.database,
        auth,
        resolveSession: async () => ({
          userId: 'admin-user',
          email: 'admin@example.com',
          name: 'Admin',
          deploymentRole: 'admin'
        })
      })
      expect(await outcome(contractClient(app).session.session())).toBe('ok')
      expect(await outcome(adminContractClient(app).operations())).toEqual({
        status: 403,
        code: 'mfa_required'
      })
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
        await outcome(
          adminContractClient(userApp, { Origin: 'https://pencil.example.com' }).operations()
        )
      ).toMatchObject({ status: 403 })
      expect(
        await outcome(
          adminContractClient(adminApp, {
            Origin: 'https://untrusted.example.com'
          }).approveEnrollment({ params: { id: 'missing' }, body: {} })
        )
      ).toMatchObject({ status: 403 })
      expect(await adminContractClient(adminApp).operations()).toMatchObject({
        enrollmentMode: 'open',
        pendingEnrollment: 0
      })
    } finally {
      await runtime.close()
    }
  })

  test('answers malformed admin input and unknown IDs with client errors', async () => {
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
      for (const path of [
        '/api/admin/audit?limit=many',
        '/api/admin/email?limit=-1',
        '/api/admin/users?offset=1.5',
        '/api/admin/users?offset=99999999999999999999',
        '/api/admin/enrollments?filter=sideways',
        '/api/admin/email?filter=bounced'
      ]) {
        const response = await adminApp.request(path)
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: { code: 'invalid_request' } })
      }
      expect(
        await outcome(
          adminContractClient(adminApp, { Origin: 'https://pencil.example.com' }).approveEnrollment(
            { params: { id: crypto.randomUUID() }, body: {} }
          )
        )
      ).toEqual({ status: 404, code: 'not_found' })
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
      const client = testClient(app)

      expect(await (await client.api.account.status.$get()).json()).toEqual({
        user: pendingIdentity,
        state: 'pending'
      })
      expect(await outcome(contractClient(app).session.session())).toMatchObject({ status: 401 })
      expect(await outcome(adminContractClient(app).enrollments({ query: {} }))).toMatchObject({
        status: 401
      })
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
          .selectFrom('apiRateLimit')
          .select(({ fn }) => fn.countAll<number>().as('count'))
          .executeTakeFirstOrThrow()
      ).toEqual({ count: 0 })
    } finally {
      await runtime.close()
    }
  })

  test('serves indexing policy through robots and response headers', async () => {
    const denied = testClient(createCloudApp(services()))
    const robots = await denied['robots.txt'].$get()
    expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n')
    expect((await denied.health.$get()).headers.get('X-Robots-Tag')).toBe(
      'noindex, nofollow, noarchive'
    )

    const allowedServices = services()
    allowedServices.config = { ...allowedServices.config, indexingPolicy: 'allow' }
    const allowedApp = createCloudApp(allowedServices)
    const allowed = testClient(allowedApp)
    expect(await (await allowed['robots.txt'].$get()).text()).toContain('Disallow: /admin')
    expect((await allowed.health.$get()).headers.get('X-Robots-Tag')).toBeNull()
    // A response header, which the contract client does not expose.
    expect((await allowedApp.request('/api/session')).headers.get('X-Robots-Tag')).toBe(
      'noindex, nofollow, noarchive'
    )
  })

  test('serves a health response without starting a listener', async () => {
    const response = await testClient(createCloudApp(services())).health.$get()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'ok',
      protocolVersion: CLOUD_PROTOCOL_VERSION
    })
  })

  test('derives discovery from validated server capabilities', async () => {
    const response = await testClient(createCloudApp(services()))['.well-known'].openpencil.$get()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      protocolVersion: CLOUD_PROTOCOL_VERSION,
      deployment: 'self-hosted',
      apiURL: 'https://pencil.example.com/api',
      authURL: 'https://pencil.example.com/api/auth',
      localEditor: true,
      authentication: {
        socialProviders: ['google'],
        enterpriseSSO: false,
        enrollmentMode: 'open'
      },
      capabilities: {
        documents: true,
        workspaces: true,
        collaboration: true,
        apps: false
      }
    })
  })

  test('lets any editor read discovery, without credentials', async () => {
    const cloud = testClient(createCloudApp(services()))
    const discovery = await cloud['.well-known'].openpencil.$get(undefined, {
      headers: { Origin: 'https://editor.example.org' }
    })
    expect(discovery.status).toBe(200)
    expect(discovery.headers.get('access-control-allow-origin')).toBe('*')
    expect(discovery.headers.get('access-control-allow-credentials')).toBeNull()
  })

  test('allows credentialed CORS for trusted origins only', async () => {
    const trusted = await createCloudApp(services()).request('/api/session', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.example.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization'
      }
    })
    expect(trusted.status).toBe(204)
    expect(trusted.headers.get('access-control-allow-origin')).toBe('https://app.example.com')
    expect(trusted.headers.get('access-control-allow-credentials')).toBe('true')
    // Editors signed in with a device code send its token as a bearer header.
    expect(trusted.headers.get('access-control-allow-headers')).toContain('Authorization')

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
      const response = await testClient(createCloudApp(available)).ready.$get()
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
    const response = await testClient(createCloudApp(unavailable)).ready.$get()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: 'unavailable' })
  })

  test('limits guest collaboration tickets on their own budget', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const proxied = parseCloudServerConfig({
        ...config,
        authTrustedIPHeaders: ['x-forwarded-for']
      })
      const app = createCloudApp({
        ...services(),
        config: proxied,
        database: runtime.database,
        auth: createBetterAuthAdapter(proxied, runtime.database)
      })
      const shareId = crypto.randomUUID()
      // The limits show in response headers, which the contract client does not expose.
      const request = (path: string) =>
        app.request(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
          body: JSON.stringify({ secret: 'a'.repeat(64) })
        })
      const ticket = await request(`/api/shares/${shareId}/collaboration-ticket`)
      // No such route: only the share budget's limiter answers it.
      const share = await request(`/api/shares/${shareId}`)
      expect(ticket.headers.get('ratelimit-policy')).toContain('60;w=60')
      expect(share.headers.get('ratelimit-policy')).toContain('30;w=60')
    } finally {
      await runtime.close()
    }
  })
})
