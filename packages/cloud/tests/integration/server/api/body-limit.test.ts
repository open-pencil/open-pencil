import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  CLOUD_API_MAX_BODY_BYTES,
  CLOUD_MAX_DOCUMENT_IMAGES,
  commitImageUploadsSchema,
  commitUploadSchema
} from '#cloud/contract'
import {
  createBetterAuthAdapter,
  createCloudApp,
  parseCloudServerConfig,
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

async function postWorkspace(name: string) {
  const runtime = await createCloudTestDatabase()
  const app = createCloudApp({
    config,
    database: runtime.database,
    auth: createBetterAuthAdapter(config, runtime.database),
    objects: createMemoryObjectStore().store,
    resolveSession: async () => alice
  })
  return app.request('/api/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: config.publicURL },
    body: JSON.stringify({ name })
  })
}

describe('Cloud API request bodies', () => {
  test('refuse a body past the API limit before reading it', async () => {
    const response = await postWorkspace('x'.repeat(CLOUD_API_MAX_BODY_BYTES))
    expect(response.status).toBe(413)
    expect(
      await responseJSON(
        response,
        v.object({ error: v.object({ code: v.literal('invalid_request') }) })
      )
    ).toEqual({ error: { code: 'invalid_request' } })
  })

  test('take a body within it', async () => {
    expect((await postWorkspace('Studio')).status).toBe(201)
  })

  test('fit the largest bodies the contract allows, which list every image of a document', () => {
    const checksum = `${'A'.repeat(43)}=`
    const images = Array.from({ length: CLOUD_MAX_DOCUMENT_IMAGES }, (_, index) => index)
    const commit = v.parse(commitUploadSchema, {
      checksum,
      name: 'n'.repeat(200),
      images: images.map((index) => ({ name: `${index}`.padStart(128, 'i'), checksum }))
    })
    const imageUploads = v.parse(commitImageUploadsSchema, {
      uploads: images.map(() => ({ uploadId: crypto.randomUUID(), checksum }))
    })
    for (const body of [commit, imageUploads]) {
      expect(new TextEncoder().encode(JSON.stringify(body)).byteLength).toBeLessThan(
        CLOUD_API_MAX_BODY_BYTES
      )
    }
  })
})
