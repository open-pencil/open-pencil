import { describe, expect, spyOn, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  CLOUD_FEATURE_KEYS,
  createBetterAuthAdapter,
  createCloudApp,
  createDefaultCloudPolicy,
  EntitlementOpenFeatureProvider,
  parseCloudServerConfig,
  StaticEntitlementSource,
  type CloudActor
} from '#cloud/server'
import * as v from 'valibot'

const config = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: 'http://localhost:8787',
  databaseURL: 'postgresql://test:test@localhost/test',
  authSecret: 'integration-test-secret-at-least-32-characters',
  s3Endpoint: 'http://localhost:9000',
  s3Region: 'us-east-1',
  s3Bucket: 'openpencil',
  s3AccessKeyId: 'openpencil',
  s3SecretAccessKey: 'openpencil-secret'
})

const alice: CloudActor = {
  userId: 'alice',
  email: 'alice@example.com',
  name: 'Alice',
  deploymentRole: 'admin'
}

const notFoundSchema = v.object({ error: v.object({ code: v.literal('not_found') }) })
const idSchema = v.object({ id: v.string() })

async function testApp() {
  const runtime = await createCloudTestDatabase()
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: createBetterAuthAdapter(config, runtime.database),
    objects: createMemoryObjectStore().store,
    // Share links need the links and guest view entitlements.
    policy: createDefaultCloudPolicy(
      new EntitlementOpenFeatureProvider(
        new StaticEntitlementSource({
          [CLOUD_FEATURE_KEYS.links]: true,
          [CLOUD_FEATURE_KEYS.guestView]: true
        })
      )
    ),
    resolveSession: async () => alice
  })
  const request = (method: string, path: string, json?: unknown) =>
    app.request(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: config.publicURL },
      body: json === undefined ? undefined : JSON.stringify(json)
    })
  const { workspace } = await responseJSON(
    await request('POST', '/workspaces', { name: 'Studio' }),
    v.object({ workspace: idSchema })
  )
  const { document } = await responseJSON(
    await request('POST', `/workspaces/${workspace.id}/documents`, { name: 'Poster' }),
    v.object({ document: idSchema })
  )
  return { runtime, request, workspaceId: workspace.id, documentId: document.id }
}

describe('Cloud API route parameters', () => {
  test('answer 404 for a malformed ID instead of sending it to the database', async () => {
    const context = await testApp()
    const logged = spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const { workspaceId, documentId } = context
      // One route per validated parameter; the others in its path name rows that exist.
      const malformed: [method: string, path: string][] = [
        ['GET', '/documents/abc'],
        ['GET', '/documents/abc/versions'],
        ['GET', `/documents/${documentId}/versions/abc`],
        ['DELETE', `/documents/${documentId}/shares/abc`],
        ['DELETE', `/documents/${documentId}/invitations/abc`],
        ['GET', '/workspaces/abc'],
        ['GET', '/workspaces/abc/documents'],
        ['GET', '/workspaces/abc/entitlements'],
        ['POST', `/workspaces/${workspaceId}/invitations/abc/resend`],
        ['POST', '/uploads/abc/commit'],
        ['POST', '/documents/abc/collaboration-ticket'],
        ['POST', '/shares/abc/collaboration-ticket'],
        ['POST', '/shares/abc/document'],
        ['POST', '/invitations/abc/preview'],
        ['POST', '/invitations/abc/accept'],
        ['POST', '/admin/email/abc/regenerate'],
        ['GET', '/admin/users/abc']
      ]
      for (const [method, path] of malformed) {
        const response = await context.request(method, path, method === 'GET' ? undefined : {})
        expect({ method, path, status: response.status }).toEqual({ method, path, status: 404 })
        await responseJSON(response, notFoundSchema)
      }
      expect(logged).not.toHaveBeenCalled()
    } finally {
      logged.mockRestore()
      await context.runtime.close()
    }
  })

  test('pass a well-formed ID through to the route', async () => {
    const context = await testApp()
    try {
      const share = await responseJSON(
        await context.request('POST', `/documents/${context.documentId}/shares`, {
          permission: 'view'
        }),
        v.object({ share: idSchema, secret: v.string() })
      )
      const resolved = await context.request('POST', `/shares/${share.share.id}/resolve`, {
        secret: share.secret
      })
      expect(resolved.status).toBe(200)
      const access = await context.request('GET', `/documents/${context.documentId}/access`)
      expect(access.status).toBe(200)
    } finally {
      await context.runtime.close()
    }
  })
})
