import { describe, expect, test } from 'bun:test'

import { contractClient, outcome } from '#cloud-tests/helpers/contract'
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
import { testClient } from 'hono/testing'

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
      const client = testClient(app)
      const sameOrigin = { headers: { Origin: config.publicURL } }
      const api = contractClient(app, sameOrigin.headers)
      const report = (secret = capability.secret) =>
        api.publicSharing.fileReport({
          params: { shareId: capability.share.id },
          body: {
            secret,
            guestId: 'guest-0123456789abcdef',
            reason: 'spam-phishing',
            description: 'A fake sign-in page'
          }
        })

      // The answer says nothing about the document.
      expect(await report()).toEqual({ received: true })
      expect(await outcome(report('f'.repeat(48)))).toMatchObject({ status: 404 })
      for (let sent = 1; sent < DOCUMENT_REPORT_BUDGET.perReporter; sent++) {
        expect(await outcome(report())).toBe('ok')
      }
      expect(await outcome(report())).toMatchObject({ status: 429 })

      signedIn = true
      const listed = await responseJSON(
        await client.api.admin.reports.$get({ query: {} }),
        cloudAdminReportsResponseSchema
      )
      expect(listed.counts.open).toBe(DOCUMENT_REPORT_BUDGET.perReporter)
      expect(
        (
          await client.api.admin.documents[':id'].disable.$post(
            { param: { id: context.documentId }, json: { reason: 'Phishing' } },
            sameOrigin
          )
        ).status
      ).toBe(200)

      signedIn = false
      expect(
        await outcome(
          api.publicSharing.resolveShare({
            params: { shareId: capability.share.id },
            body: { secret: capability.secret }
          })
        )
      ).toMatchObject({ status: 404 })
    } finally {
      await context.runtime.close()
    }
  })
})
