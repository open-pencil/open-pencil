import { describe, expect, spyOn, test } from 'bun:test'

import { contractClient, outcome } from '#cloud-tests/helpers/contract'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { responseJSON } from '#cloud-tests/helpers/response'
import { collaborationTicketSchema } from '#cloud/contract'
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
import { testClient } from 'hono/testing'
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
    // Share links need the links and guest view entitlements, tickets the collaboration one.
    policy: createDefaultCloudPolicy(
      new EntitlementOpenFeatureProvider(
        new StaticEntitlementSource({
          [CLOUD_FEATURE_KEYS.links]: true,
          [CLOUD_FEATURE_KEYS.guestView]: true,
          [CLOUD_FEATURE_KEYS.collaboration]: true
        })
      )
    ),
    resolveSession: async () => alice
  })
  const headers = { Origin: config.publicURL }
  const { api } = testClient(app, undefined, undefined, { headers })
  const contract = contractClient(app, headers)
  const { workspace } = await responseJSON(
    await api.workspaces.$post({ json: { name: 'Studio' } }),
    v.object({ workspace: idSchema })
  )
  const { document } = await contract.documents.create({
    params: { workspaceId: workspace.id },
    body: { name: 'Poster' }
  })
  return { runtime, api, contract, workspaceId: workspace.id, documentId: document.id }
}

describe('Cloud API route parameters', () => {
  test('answer 404 for a malformed ID instead of sending it to the database', async () => {
    const context = await testApp()
    const logged = spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const { api, contract, workspaceId, documentId } = context
      const secret = 'a'.repeat(64)
      // One route per validated parameter; the others in its path name rows that exist.
      const malformed: [
        route: string,
        request: () => Promise<Pick<Response, 'status' | 'text'>>
      ][] = [
        [
          'DELETE /documents/:documentId/shares/abc',
          () =>
            api.documents[':documentId'].shares[':shareId'].$delete({
              param: { documentId, shareId: 'abc' }
            })
        ],
        [
          'DELETE /documents/:documentId/invitations/abc',
          () =>
            api.documents[':documentId'].invitations[':invitationId'].$delete({
              param: { documentId, invitationId: 'abc' }
            })
        ],
        [
          'GET /workspaces/abc',
          () => api.workspaces[':workspaceId'].$get({ param: { workspaceId: 'abc' } })
        ],
        [
          'GET /workspaces/abc/entitlements',
          () => api.workspaces[':workspaceId'].entitlements.$get({ param: { workspaceId: 'abc' } })
        ],
        [
          'POST /workspaces/:workspaceId/invitations/abc/resend',
          () =>
            api.workspaces[':workspaceId'].invitations[':invitationId'].resend.$post({
              param: { workspaceId, invitationId: 'abc' }
            })
        ],
        [
          'POST /documents/abc/collaboration-ticket',
          () =>
            api.documents[':documentId']['collaboration-ticket'].$post({
              param: { documentId: 'abc' }
            })
        ],
        [
          'POST /shares/abc/collaboration-ticket',
          () =>
            api.shares[':shareId']['collaboration-ticket'].$post({
              param: { shareId: 'abc' },
              json: { secret }
            })
        ],
        [
          'POST /shares/abc/document',
          () =>
            api.shares[':shareId'].document.$post({ param: { shareId: 'abc' }, json: { secret } })
        ],
        [
          'POST /invitations/abc/preview',
          () =>
            api.invitations[':invitationId'].preview.$post({
              param: { invitationId: 'abc' },
              json: { token: secret }
            })
        ],
        [
          'POST /invitations/abc/accept',
          () =>
            api.invitations[':invitationId'].accept.$post({
              param: { invitationId: 'abc' },
              json: { token: secret }
            })
        ],
        [
          'POST /admin/email/abc/regenerate',
          () => api.admin.email[':id'].regenerate.$post({ param: { id: 'abc' } })
        ],
        ['GET /admin/users/abc', () => api.admin.users[':id'].$get({ param: { id: 'abc' } })]
      ]
      for (const [route, request] of malformed) {
        const response = await request()
        expect({ route, status: response.status }).toEqual({ route, status: 404 })
        await responseJSON(response, notFoundSchema)
      }
      const malformedContract: [route: string, call: () => Promise<unknown>][] = [
        [
          'GET /documents/abc',
          () => contract.documents.download({ params: { documentId: 'abc' } })
        ],
        [
          'GET /documents/abc/versions',
          () => contract.versions.list({ params: { documentId: 'abc' }, query: {} })
        ],
        [
          'GET /documents/:documentId/versions/abc',
          () => contract.versions.download({ params: { documentId, versionId: 'abc' } })
        ],
        [
          'GET /workspaces/abc/documents',
          () => contract.documents.list({ params: { workspaceId: 'abc' } })
        ],
        [
          'POST /uploads/abc/commit',
          () =>
            contract.documents.commitUpload({
              params: { uploadId: 'abc' },
              body: { checksum: `${'A'.repeat(43)}=` }
            })
        ]
      ]
      for (const [route, call] of malformedContract) {
        expect({ route, outcome: await outcome(call()) }).toEqual({
          route,
          outcome: { status: 404, code: 'not_found' }
        })
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
        await context.api.documents[':documentId'].shares.$post({
          param: { documentId: context.documentId },
          json: { permission: 'view' }
        }),
        v.object({ share: idSchema, secret: v.string() })
      )
      const resolved = await context.api.shares[':shareId'].resolve.$post({
        param: { shareId: share.share.id },
        json: { secret: share.secret }
      })
      expect(resolved.status).toBe(200)
      expect(
        await outcome(
          context.contract.documents.access({ params: { documentId: context.documentId } })
        )
      ).toBe('ok')
    } finally {
      await context.runtime.close()
    }
  })

  test('give an ID one spelling, so a document has one relay', async () => {
    const context = await testApp()
    try {
      const { ticket } = await responseJSON(
        await context.api.documents[':documentId']['collaboration-ticket'].$post({
          param: { documentId: context.documentId.toUpperCase() }
        }),
        v.object({ ticket: collaborationTicketSchema })
      )
      expect(ticket.documentId).toBe(context.documentId)
      expect(ticket.roomId).toContain(context.documentId)
    } finally {
      await context.runtime.close()
    }
  })
})
