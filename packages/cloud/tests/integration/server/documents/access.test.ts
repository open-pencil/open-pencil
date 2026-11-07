import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-tests/helpers/database'
import { createMemoryObjectStore } from '#cloud-tests/helpers/objects'
import { createDocumentService, DocumentForbiddenError, resolveDocumentAccess } from '#cloud/server'
import { canDeleteDocument } from '#cloud/server/documents/access'

async function seedDocument() {
  const runtime = await createCloudTestDatabase()
  const workspaceId = crypto.randomUUID()
  const documentId = crypto.randomUUID()
  await runtime.database
    .insertInto('workspace')
    .values({ id: workspaceId, name: 'Design', slug: `design-${workspaceId}`, createdBy: 'owner' })
    .execute()
  await runtime.database
    .insertInto('workspaceMember')
    .values([
      { workspaceId, userId: 'owner', role: 'admin' },
      { workspaceId, userId: 'editor', role: 'editor' },
      { workspaceId, userId: 'viewer', role: 'viewer' },
      { workspaceId, userId: 'promoted', role: 'viewer' }
    ])
    .execute()
  await runtime.database
    .insertInto('document')
    .values({ id: documentId, workspaceId, name: 'Homepage', createdBy: 'owner' })
    .execute()
  return { runtime, documentId }
}

describe('document access resolution', () => {
  test('gives a document’s maker no access once removed from its workspace', async () => {
    const context = await seedDocument()
    try {
      await context.runtime.database
        .updateTable('document')
        .set({ createdBy: 'viewer' })
        .where('id', '=', context.documentId)
        .execute()
      expect(
        await resolveDocumentAccess(context.runtime.database, 'viewer', context.documentId)
      ).toMatchObject({ permission: 'edit', sources: ['owner', 'workspace'] })

      await context.runtime.database
        .deleteFrom('workspaceMember')
        .where('userId', '=', 'viewer')
        .execute()
      expect(
        await resolveDocumentAccess(context.runtime.database, 'viewer', context.documentId)
      ).toBeUndefined()

      // An edit grant lets them edit again, never delete what they once made.
      await context.runtime.database
        .insertInto('documentGrant')
        .values({
          id: crypto.randomUUID(),
          documentId: context.documentId,
          userId: 'viewer',
          permission: 'edit',
          createdBy: 'owner'
        })
        .execute()
      expect(await canDeleteDocument(context.runtime.database, 'viewer', context.documentId)).toBe(
        false
      )
    } finally {
      await context.runtime.close()
    }
  })

  test('combines owner, workspace, and direct grant sources using strongest access', async () => {
    const context = await seedDocument()
    try {
      await context.runtime.database
        .insertInto('documentGrant')
        .values({
          id: crypto.randomUUID(),
          documentId: context.documentId,
          userId: 'promoted',
          permission: 'edit',
          createdBy: 'owner'
        })
        .execute()

      expect(
        await resolveDocumentAccess(context.runtime.database, 'owner', context.documentId)
      ).toEqual({
        permission: 'edit',
        canManageSharing: true,
        sources: ['owner', 'workspace']
      })
      expect(
        await resolveDocumentAccess(context.runtime.database, 'viewer', context.documentId)
      ).toEqual({
        permission: 'view',
        canManageSharing: false,
        sources: ['workspace']
      })
      expect(
        await resolveDocumentAccess(context.runtime.database, 'promoted', context.documentId)
      ).toEqual({
        permission: 'edit',
        canManageSharing: true,
        sources: ['workspace', 'direct-grant']
      })
    } finally {
      await context.runtime.close()
    }
  })

  test('supports direct grants outside a workspace and ignores revoked grants', async () => {
    const context = await seedDocument()
    try {
      const grantId = crypto.randomUUID()
      await context.runtime.database
        .insertInto('documentGrant')
        .values({
          id: grantId,
          documentId: context.documentId,
          userId: 'guest-user',
          permission: 'view',
          createdBy: 'owner'
        })
        .execute()
      expect(
        await resolveDocumentAccess(context.runtime.database, 'guest-user', context.documentId)
      ).toMatchObject({
        permission: 'view',
        sources: ['direct-grant']
      })

      await context.runtime.database
        .updateTable('documentGrant')
        .set({ revokedAt: new Date() })
        .where('id', '=', grantId)
        .execute()
      expect(
        await resolveDocumentAccess(context.runtime.database, 'guest-user', context.documentId)
      ).toBeUndefined()
      expect(
        await resolveDocumentAccess(context.runtime.database, 'stranger', context.documentId)
      ).toBeUndefined()
    } finally {
      await context.runtime.close()
    }
  })

  test('lets only the owner and workspace admins and editors delete a document', async () => {
    const context = await seedDocument()
    try {
      await context.runtime.database
        .insertInto('documentGrant')
        .values([
          {
            id: crypto.randomUUID(),
            documentId: context.documentId,
            userId: 'promoted',
            permission: 'edit',
            createdBy: 'owner'
          },
          {
            id: crypto.randomUUID(),
            documentId: context.documentId,
            userId: 'invited',
            permission: 'edit',
            createdBy: 'owner'
          }
        ])
        .execute()
      const documents = createDocumentService(
        context.runtime.database,
        createMemoryObjectStore().store
      )
      for (const userId of ['promoted', 'invited', 'viewer']) {
        await expect(documents.remove(userId, context.documentId)).rejects.toBeInstanceOf(
          DocumentForbiddenError
        )
      }
      await documents.remove('editor', context.documentId)
      expect(
        await resolveDocumentAccess(context.runtime.database, 'owner', context.documentId)
      ).toBeUndefined()
    } finally {
      await context.runtime.close()
    }
  })
})
