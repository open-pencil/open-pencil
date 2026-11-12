import { describe, expect, test } from 'bun:test'

import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import { seedSharing } from '#cloud-tests/helpers/sharing'
import { cloudAdminReportsResponseSchema } from '#cloud/contract'
import {
  createBetterAuthAdapter,
  createCloudApp,
  createDefaultCloudPolicy,
  DOCUMENT_REPORT_BUDGET,
  parseCloudServerConfig
} from '#cloud/server'

const config = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: 'https://pencil.example.com',
  databaseURL: 'postgresql://test:test@localhost/test',
  authSecret: 'integration-test-secret-at-least-32-characters',
  s3Endpoint: 'http://localhost:9000',
  s3Region: 'us-east-1',
  s3Bucket: 'openpencil',
  s3AccessKeyId: 'openpencil',
  s3SecretAccessKey: 'openpencil-secret'
})

describe('report routes', () => {
  test('a guest reports a link, an administrator takes its document down, the link stops', async () => {
    const context = await seedSharing()
    try {
      let signedIn = false
      const app = createCloudApp({
        config,
        database: context.runtime.database,
        auth: createBetterAuthAdapter(config, context.runtime.database),
        objects: createMemoryObjectStore().store,
        // Guests may view links, as the default policy lets them.
        policy: createDefaultCloudPolicy(),
        resolveSession: async () =>
          signedIn
            ? {
                userId: crypto.randomUUID(),
                email: 'admin@example.com',
                name: 'Admin',
                deploymentRole: 'admin'
              }
            : null
      })
      const capability = await context.sharing.createShare('owner', context.documentId, {
        permission: 'view'
      })
      const request = (path: string, json?: unknown) =>
        app.request(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: config.publicURL },
          body: JSON.stringify(json ?? {})
        })
      const report = (secret = capability.secret) =>
        request(`/api/shares/${capability.share.id}/reports`, {
          secret,
          guestId: 'guest-0123456789abcdef',
          reason: 'spam-phishing',
          description: 'A fake sign-in page'
        })

      const filed = await report()
      expect(filed.status).toBe(201)
      // The answer says nothing about the document.
      expect(await filed.json()).toEqual({ received: true })
      expect((await report('f'.repeat(48))).status).toBe(404)
      for (let sent = 1; sent < DOCUMENT_REPORT_BUDGET.perReporter; sent++) {
        expect((await report()).status).toBe(201)
      }
      expect((await report()).status).toBe(429)

      signedIn = true
      const listed = await responseJSON(
        await app.request('/api/admin/reports'),
        cloudAdminReportsResponseSchema
      )
      expect(listed.counts.open).toBe(DOCUMENT_REPORT_BUDGET.perReporter)
      expect(
        (
          await request(`/api/admin/documents/${context.documentId}/disable`, {
            reason: 'Phishing'
          })
        ).status
      ).toBe(200)

      signedIn = false
      const opened = await request(`/api/shares/${capability.share.id}/resolve`, {
        secret: capability.secret
      })
      expect(opened.status).toBe(404)
    } finally {
      await context.runtime.close()
    }
  })
})
