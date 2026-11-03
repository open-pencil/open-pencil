import { describe, expect, spyOn, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import { createBetterAuthAdapter, createCloudApp, parseCloudServerConfig } from '#cloud/server'
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

const MISSING = '00000000-0000-4000-8000-000000000000'

/** One route per guarded parameter, with that parameter malformed and the others well formed. */
const MALFORMED: [method: string, path: string][] = [
  ['GET', '/api/documents/abc'],
  ['GET', '/api/documents/abc/versions'],
  ['GET', `/api/documents/${MISSING}/versions/abc`],
  ['DELETE', `/api/documents/${MISSING}/shares/abc`],
  ['DELETE', `/api/documents/${MISSING}/invitations/abc`],
  ['GET', '/api/workspaces/abc'],
  ['GET', '/api/workspaces/abc/documents'],
  ['GET', '/api/workspaces/abc/entitlements'],
  ['POST', `/api/workspaces/${MISSING}/invitations/abc/resend`],
  ['POST', '/api/uploads/abc/commit'],
  ['POST', '/api/shares/abc/document'],
  ['POST', '/api/invitations/abc/preview'],
  ['POST', '/api/invitations/abc/accept']
]

const notFoundSchema = v.object({ error: v.object({ code: v.literal('not_found') }) })

describe('Cloud API UUID parameters', () => {
  test('answers 404 for a malformed ID instead of sending it to the database', async () => {
    const runtime = await createCloudTestDatabase()
    const logged = spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const app = createCloudApp({
        config,
        database: runtime.database,
        auth: createBetterAuthAdapter(config, runtime.database),
        objects: createMemoryObjectStore().store,
        resolveSession: async () => ({ userId: 'alice', email: 'alice@example.com', name: 'Alice' })
      })
      for (const [method, path] of MALFORMED) {
        const response = await app.request(path, {
          method,
          headers: { 'Content-Type': 'application/json', Origin: config.publicURL },
          body: method === 'GET' ? undefined : '{}'
        })
        expect({ method, path, status: response.status }).toEqual({ method, path, status: 404 })
        await responseJSON(response, notFoundSchema)
      }
      expect(logged).not.toHaveBeenCalled()
    } finally {
      logged.mockRestore()
      await runtime.close()
    }
  })
})
