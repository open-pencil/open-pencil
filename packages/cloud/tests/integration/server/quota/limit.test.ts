import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import {
  createCollaborationTicketService,
  createDefaultCloudPolicy,
  createDocumentService,
  createDocumentSharingService,
  EntitlementOpenFeatureProvider,
  StaticEntitlementSource,
  staticEntitlementValues,
  StorageQuotaExceededError
} from '#cloud/server'
import { storageLimitReached } from '#cloud/server/policy/storage'

const MAXIMUM_BYTES = 1000
const editor = { userId: 'owner', name: 'Owner', email: 'owner@example.com' }

/** An owner on a plan of `MAXIMUM_BYTES`, holding `heldBytes` in one workspace with a document. */
async function seed(heldBytes: number) {
  const runtime = await createCloudTestDatabase()
  const workspaceId = crypto.randomUUID()
  const documentId = crypto.randomUUID()
  await runtime.database
    .insertInto('workspace')
    .values({
      id: workspaceId,
      name: 'Design',
      slug: `design-${workspaceId}`,
      createdBy: 'owner',
      ownerId: 'owner'
    })
    .execute()
  await runtime.database
    .insertInto('workspaceMember')
    .values({ workspaceId, userId: 'owner', role: 'admin' })
    .execute()
  await runtime.database
    .insertInto('document')
    .values({ id: documentId, workspaceId, name: 'Homepage', createdBy: 'owner' })
    .execute()
  await runtime.database
    .insertInto('workspaceStorageUsage')
    .values({ workspaceId, committedBytes: heldBytes })
    .execute()
  const policy = createDefaultCloudPolicy(
    new EntitlementOpenFeatureProvider(
      new StaticEntitlementSource(
        staticEntitlementValues({
          storage: { maximumBytes: MAXIMUM_BYTES },
          collaboration: { enabled: true }
        })
      )
    )
  )
  const documents = createDocumentService(runtime.database, createMemoryObjectStore().store, {
    policy
  })
  const tickets = createCollaborationTicketService({
    database: runtime.database,
    sharing: createDocumentSharingService(runtime.database),
    authSecret: 'storage-limit-test-secret-at-least-32-characters',
    policy
  })
  return { runtime, workspaceId, documentId, policy, documents, tickets }
}

const upload = {
  baseRevisionId: null,
  byteSize: 1,
  checksum: `${'A'.repeat(43)}=`,
  contentType: 'application/octet-stream' as const
}

describe('an owner at their storage limit', () => {
  test('is read-only once they hold their whole allowance, and not before', async () => {
    for (const [held, reached] of [
      [MAXIMUM_BYTES - 1, false],
      [MAXIMUM_BYTES, true],
      [MAXIMUM_BYTES * 2, true]
    ] as const) {
      const context = await seed(held)
      try {
        expect(
          await storageLimitReached(context.runtime.database, context.policy, {
            documentId: context.documentId
          })
        ).toBe(reached)
      } finally {
        await context.runtime.close()
      }
    }
  })

  test('gets view tickets that say why, while an owner under it edits', async () => {
    const full = await seed(MAXIMUM_BYTES)
    const roomy = await seed(0)
    try {
      expect(await full.tickets.issueUserTicket(editor, full.documentId)).toMatchObject({
        permission: 'view',
        readOnly: 'storage-limit'
      })
      const ticket = await roomy.tickets.issueUserTicket(editor, roomy.documentId)
      expect(ticket.permission).toBe('edit')
      expect(ticket.readOnly).toBeUndefined()
    } finally {
      await full.runtime.close()
      await roomy.runtime.close()
    }
  })

  test('saves nothing and makes no documents, but still deletes', async () => {
    const context = await seed(MAXIMUM_BYTES)
    try {
      await expect(
        context.documents.createUpload('owner', context.documentId, upload)
      ).rejects.toBeInstanceOf(StorageQuotaExceededError)
      await expect(
        context.documents.create('owner', context.workspaceId, { name: 'New', kind: 'design' })
      ).rejects.toBeInstanceOf(StorageQuotaExceededError)
      await context.documents.remove('owner', context.documentId)
    } finally {
      await context.runtime.close()
    }
  })
})
