import { expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { createCloudAPIClient, CloudAPIError } from '#cloud/client'
import {
  createBetterAuthAdapter,
  createCloudApp,
  createDefaultCloudPolicy,
  EntitlementOpenFeatureProvider,
  parseCloudServerConfig,
  StaticEntitlementSource,
  type CloudActor
} from '#cloud/server'

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

test('the client and server speak the documents contract, errors included', async () => {
  const runtime = await createCloudTestDatabase()
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: createBetterAuthAdapter(config, runtime.database),
    objects: createMemoryObjectStore().store,
    policy: createDefaultCloudPolicy(
      new EntitlementOpenFeatureProvider(new StaticEntitlementSource({}))
    ),
    resolveSession: async () => alice
  })
  try {
    const client = createCloudAPIClient('http://localhost:8787/api', {
      fetch: async (input, init) => {
        const r = new Request(input, init)
        return app.request(r)
      }
    })
    const personal =
      (await client.listWorkspaces()).workspaces[0] ?? (await client.createWorkspace('Studio'))
    const created = await client.createDocument(personal.id, { name: 'Spike' })
    expect(created.kind).toBe('design')
    const listed = await client.listDocuments(personal.id)
    expect(listed.map((d) => d.name)).toEqual(['Spike'])
    expect((await client.getDocumentAccess(created.id)).permission).toBe('edit')
    expect((await client.getUsage(personal.id)).documentCount).toBe(1)
    const upload = await client.createUpload(created.id, {
      baseRevisionId: null,
      byteSize: 4,
      checksum: 'n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=',
      contentType: 'application/octet-stream'
    })
    expect(upload.upload.kind).toBe('single')
    await client.deleteDocument(created.id)
    expect((await client.listTrash()).map((d) => d.id)).toEqual([created.id])
    await client.restoreDocument(created.id)
    const missing = await client
      .getDocumentAccess('00000000-0000-4000-8000-000000000000')
      .catch((e: unknown) => e)
    expect(missing).toBeInstanceOf(CloudAPIError)
    expect(missing).toMatchObject({ status: 404, code: 'not_found' })
    const malformed = await client.getDocumentAccess('not-a-uuid').catch((e: unknown) => e)
    expect(malformed).toMatchObject({ status: 404, code: 'not_found' })
    const invalid = await client.createDocument(personal.id, { name: '' }).catch((e: unknown) => e)
    expect(invalid).toMatchObject({ status: 400, code: 'invalid_request' })
    // HEAD answers as GET does, without the body; a path with a trailing slash is not a route.
    const head = await app.request(
      new Request(`http://localhost:8787/api/workspaces/${personal.id}/documents`, {
        method: 'HEAD'
      })
    )
    expect(head.status).toBe(200)
    expect(await head.text()).toBe('')
    const slashed = await app.request(
      new Request(`http://localhost:8787/api/workspaces/${personal.id}/documents/`)
    )
    expect(slashed.status).toBe(404)
  } finally {
    await runtime.close()
  }
})
