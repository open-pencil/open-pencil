import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'

import { resolveDocumentAccess } from '@open-pencil/cloud/server'

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
})
