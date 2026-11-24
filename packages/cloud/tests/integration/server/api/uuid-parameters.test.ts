import { describe, expect, spyOn, test } from 'bun:test'

import { adminContractClient, contractClient, outcome } from '#cloud-tests/helpers/contract'
import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
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
  const contract = contractClient(app, headers)
  const admin = adminContractClient(app, headers)
  const { workspace } = await contract.workspaces.create({ body: { name: 'Studio' } })
  const { document } = await contract.documents.create({
    params: { workspaceId: workspace.id },
    body: { name: 'Poster' }
  })
  return { runtime, contract, admin, workspaceId: workspace.id, documentId: document.id }
}

describe('Cloud API route parameters', () => {
  test('answer 404 for a malformed ID instead of sending it to the database', async () => {
    const context = await testApp()
    const logged = spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const { contract, admin, workspaceId, documentId } = context
      const secret = 'a'.repeat(64)
      // One route per validated parameter; the others in its path name rows that exist.
      const malformedContract: [route: string, call: () => Promise<unknown>][] = [
        [
          'POST /admin/email/abc/regenerate',
          () => admin.regenerateEmail({ params: { id: 'abc' } })
        ],
        ['GET /admin/users/abc', () => admin.user({ params: { id: 'abc' } })],
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
          'DELETE /documents/:documentId/shares/abc',
          () => contract.sharing.revokeShare({ params: { documentId, shareId: 'abc' } })
        ],
        [
          'DELETE /documents/:documentId/invitations/abc',
          () => contract.sharing.revokeInvitation({ params: { documentId, invitationId: 'abc' } })
        ],
        [
          'POST /documents/abc/collaboration-ticket',
          () => contract.sharing.collaborationTicket({ params: { documentId: 'abc' } })
        ],
        [
          'POST /shares/abc/collaboration-ticket',
          () =>
            contract.publicSharing.collaborationTicket({
              params: { shareId: 'abc' },
              body: { secret }
            })
        ],
        [
          'POST /shares/abc/document',
          () => contract.publicSharing.document({ params: { shareId: 'abc' }, body: { secret } })
        ],
        [
          'POST /invitations/abc/preview',
          () =>
            contract.publicSharing.previewInvitation({
              params: { invitationId: 'abc' },
              body: { token: secret }
            })
        ],
        [
          'POST /invitations/abc/accept',
          () =>
            contract.sharing.acceptInvitation({
              params: { invitationId: 'abc' },
              body: { token: secret }
            })
        ],
        ['GET /workspaces/abc', () => contract.workspaces.get({ params: { workspaceId: 'abc' } })],
        [
          'GET /workspaces/abc/entitlements',
          () => contract.workspaces.entitlements({ params: { workspaceId: 'abc' } })
        ],
        [
          'POST /workspaces/:workspaceId/invitations/abc/resend',
          () =>
            contract.workspaces.resendInvitation({ params: { workspaceId, invitationId: 'abc' } })
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
      const share = await context.contract.sharing.createShare({
        params: { documentId: context.documentId },
        body: { permission: 'view' }
      })
      expect(
        await outcome(
          context.contract.publicSharing.resolveShare({
            params: { shareId: share.share.id },
            body: { secret: share.secret }
          })
        )
      ).toBe('ok')
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
      const { ticket } = await context.contract.sharing.collaborationTicket({
        params: { documentId: context.documentId.toUpperCase() }
      })
      expect(ticket.documentId).toBe(context.documentId)
      expect(ticket.roomId).toContain(context.documentId)
    } finally {
      await context.runtime.close()
    }
  })
})
