import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'

import {
  CLOUD_FEATURE_KEYS,
  createDefaultCloudPolicy,
  createDocumentSharingService,
  DocumentForbiddenError,
  DocumentShareInvalidError,
  EntitlementOpenFeatureProvider,
  StaticEntitlementSource
} from '@open-pencil/cloud/server'

async function seed() {
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
      { workspaceId, userId: 'viewer', role: 'viewer' }
    ])
    .execute()
  await runtime.database
    .insertInto('document')
    .values({ id: documentId, workspaceId, name: 'Homepage', createdBy: 'owner' })
    .execute()
  return { runtime, documentId, sharing: createDocumentSharingService(runtime.database) }
}

function sharingWithPolicy(
  context: Awaited<ReturnType<typeof seed>>,
  values: Record<string, boolean>,
  deploymentMode: 'official' | 'self-hosted' = 'self-hosted'
) {
  const policy = createDefaultCloudPolicy(
    new EntitlementOpenFeatureProvider(new StaticEntitlementSource(values))
  )
  return createDocumentSharingService(context.runtime.database, { policy, deploymentMode })
}

describe('document sharing service', () => {
  test('creates hash-only capabilities and resolves user and guest principals', async () => {
    const context = await seed()
    try {
      const capability = await context.sharing.createShare('owner', context.documentId, {
        permission: 'view'
      })
      expect(capability.secret).toHaveLength(32)
      expect(capability.path).toBe(`/share/${capability.share.id}#${capability.secret}`)
      const stored = await context.runtime.database
        .selectFrom('documentShare')
        .select(['secretHash', 'lastUsedAt'])
        .where('id', '=', capability.share.id)
        .executeTakeFirstOrThrow()
      expect(stored.secretHash).not.toContain(capability.secret)
      expect(stored.lastUsedAt).toBeNull()

      const guest = await context.sharing.resolveShare(capability.share.id, {
        secret: capability.secret,
        guestName: 'Visitor'
      })
      expect(guest).toMatchObject({
        documentId: context.documentId,
        permission: 'view',
        principal: { kind: 'guest', name: 'Visitor' }
      })
      const user = await context.sharing.resolveShare(
        capability.share.id,
        { secret: capability.secret },
        { userId: 'alice', name: 'Alice', email: 'alice@example.com' }
      )
      expect(user.principal).toEqual({
        kind: 'user',
        userId: 'alice',
        name: 'Alice',
        email: 'alice@example.com'
      })
    } finally {
      await context.runtime.close()
    }
  })

  test('rotates and revokes capabilities without exposing prior secrets', async () => {
    const context = await seed()
    try {
      const original = await context.sharing.createShare('owner', context.documentId, {
        permission: 'edit'
      })
      const rotated = await context.sharing.rotateShare(
        'owner',
        context.documentId,
        original.share.id
      )
      expect(rotated.secret).not.toBe(original.secret)
      expect(rotated.share.roomEpoch).toBe(0)
      await expect(
        context.sharing.resolveShare(original.share.id, { secret: original.secret })
      ).rejects.toBeInstanceOf(DocumentShareInvalidError)
      expect(
        await context.sharing.resolveShare(original.share.id, { secret: rotated.secret })
      ).toMatchObject({ permission: 'edit', roomEpoch: 0 })

      await context.sharing.revokeShare('owner', context.documentId, original.share.id)
      await expect(
        context.sharing.resolveShare(original.share.id, { secret: rotated.secret })
      ).rejects.toBeInstanceOf(DocumentShareInvalidError)
    } finally {
      await context.runtime.close()
    }
  })

  test('enforces capability policy on share updates', async () => {
    const context = await seed()
    try {
      const enabled = await sharingWithPolicy(context, {
        [CLOUD_FEATURE_KEYS.capabilityLinks]: true,
        [CLOUD_FEATURE_KEYS.anonymousEdit]: false
      })
      const capability = await enabled.createShare('owner', context.documentId, {
        permission: 'view'
      })
      await expect(
        enabled.updateShare('owner', context.documentId, capability.share.id, {
          permission: 'edit'
        })
      ).rejects.toBeInstanceOf(DocumentForbiddenError)
      expect(
        await enabled.updateShare('owner', context.documentId, capability.share.id, {
          permission: 'view'
        })
      ).toMatchObject({ permission: 'view' })

      for (const deploymentMode of ['official', 'self-hosted'] as const) {
        const disabled = await sharingWithPolicy(
          context,
          {
            [CLOUD_FEATURE_KEYS.capabilityLinks]: false,
            [CLOUD_FEATURE_KEYS.anonymousEdit]: true
          },
          deploymentMode
        )
        await expect(
          disabled.updateShare('owner', context.documentId, capability.share.id, {
            permission: 'view'
          })
        ).rejects.toBeInstanceOf(DocumentForbiddenError)
      }
    } finally {
      await context.runtime.close()
    }
  })

  test('manages direct grants and pending invitations', async () => {
    const context = await seed()
    try {
      const grant = await context.sharing.putGrant('owner', context.documentId, 'outside-user', {
        permission: 'view'
      })
      expect(grant).toMatchObject({ userId: 'outside-user', permission: 'view' })
      expect(await context.sharing.listGrants('owner', context.documentId)).toHaveLength(1)
      await context.sharing.revokeGrant('owner', context.documentId, 'outside-user')
      expect(await context.sharing.listGrants('owner', context.documentId)).toEqual([])

      const created = await context.sharing.createInvitation('owner', context.documentId, {
        email: 'person@example.com',
        permission: 'edit'
      })
      expect(created.token).toHaveLength(32)
      expect(created.invitation).toMatchObject({
        email: 'person@example.com',
        permission: 'edit'
      })
      expect(await context.sharing.listInvitations('owner', context.documentId)).toHaveLength(1)
      const accepted = await context.sharing.acceptInvitation(
        { userId: 'invited-user', name: 'Invited', email: 'person@example.com' },
        created.invitation.id,
        { token: created.token }
      )
      expect(accepted).toMatchObject({
        userId: 'invited-user',
        permission: 'edit'
      })
      expect(
        (await context.sharing.listInvitations('owner', context.documentId))[0]?.acceptedAt
      ).toBeString()
      await expect(
        context.sharing.acceptInvitation(
          { userId: 'second-user', name: 'Second', email: 'person@example.com' },
          created.invitation.id,
          { token: created.token }
        )
      ).rejects.toBeInstanceOf(DocumentShareInvalidError)

      const pending = await context.sharing.createInvitation('owner', context.documentId, {
        email: 'pending@example.com',
        permission: 'view'
      })
      await context.sharing.revokeInvitation('owner', context.documentId, pending.invitation.id)
      expect(await context.sharing.listInvitations('owner', context.documentId)).toHaveLength(1)
    } finally {
      await context.runtime.close()
    }
  })

  test('delivers fragment-protected invitation URLs without storing raw tokens', async () => {
    const context = await seed()
    const delivered: Array<{
      recipientEmail: string
      inviterName: string
      documentName: string
      acceptanceURL: string
    }> = []
    try {
      await context.runtime.database
        .insertInto('user')
        .values({
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Owner Name',
          email: 'owner@example.com',
          emailVerified: true,
          image: null
        })
        .execute()
      const workspace = await context.runtime.database
        .selectFrom('document')
        .select('workspaceId')
        .where('id', '=', context.documentId)
        .executeTakeFirstOrThrow()
      await context.runtime.database
        .updateTable('workspaceMember')
        .set({ userId: '11111111-1111-4111-8111-111111111111' })
        .where('workspaceId', '=', workspace.workspaceId)
        .where('userId', '=', 'owner')
        .execute()
      const sharing = createDocumentSharingService(context.runtime.database, {
        publicURL: 'https://cloud.example.com',
        appURL: 'https://app.example.com',
        delivery: {
          async sendDocumentInvitation(message) {
            delivered.push(message)
          }
        }
      })
      const created = await sharing.createInvitation(
        '11111111-1111-4111-8111-111111111111',
        context.documentId,
        {
          email: 'person@example.com',
          permission: 'edit'
        }
      )
      expect(delivered).toHaveLength(1)
      expect(delivered[0]).toMatchObject({
        recipientEmail: 'person@example.com',
        inviterName: 'Owner Name',
        documentName: 'Homepage'
      })
      const deliveryURL = new URL(delivered[0]?.acceptanceURL ?? '')
      expect(
        await sharing.previewInvitation(created.invitation.id, { token: created.token })
      ).toEqual({
        documentName: 'Homepage',
        inviterName: 'Owner Name',
        permission: 'edit',
        expiresAt: created.invitation.expiresAt,
        recipientHint: 'pe****@example.com'
      })
      expect(deliveryURL.origin).toBe('https://app.example.com')
      expect(deliveryURL.pathname).toBe(`/cloud/invitations/${created.invitation.id}`)
      expect(deliveryURL.searchParams.get('server')).toBe('https://cloud.example.com')
      expect(deliveryURL.hash).toBe(`#${created.token}`)
      const stored = await context.runtime.database
        .selectFrom('documentInvitation')
        .select('tokenHash')
        .where('id', '=', created.invitation.id)
        .executeTakeFirstOrThrow()
      expect(stored.tokenHash).not.toContain(created.token)
    } finally {
      await context.runtime.close()
    }
  })

  test('encrypts and consumes OAuth invitation continuations once', async () => {
    const context = await seed()
    try {
      const sharing = createDocumentSharingService(context.runtime.database, {
        continuationSecret: 'continuation-test-secret-at-least-32-characters'
      })
      const created = await sharing.createInvitation('owner', context.documentId, {
        email: 'continuation@example.com',
        permission: 'view'
      })
      const continuation = await sharing.createInvitationContinuation({
        invitationId: created.invitation.id,
        token: created.token
      })
      const stored = await context.runtime.database
        .selectFrom('invitationContinuation')
        .select('tokenEncrypted')
        .where('id', '=', continuation.id)
        .executeTakeFirstOrThrow()
      expect(stored.tokenEncrypted).not.toContain(created.token)
      expect(stored.tokenEncrypted.split('.')).toHaveLength(5)
      expect(await sharing.consumeInvitationContinuation(continuation.id)).toEqual({
        invitationId: created.invitation.id,
        token: created.token
      })
      await expect(sharing.consumeInvitationContinuation(continuation.id)).rejects.toBeInstanceOf(
        DocumentShareInvalidError
      )
    } finally {
      await context.runtime.close()
    }
  })

  test('revokes invitations when delivery fails', async () => {
    const context = await seed()
    try {
      const sharing = createDocumentSharingService(context.runtime.database, {
        publicURL: 'https://cloud.example.com',
        appURL: 'https://app.example.com',
        delivery: {
          async sendDocumentInvitation() {
            throw new Error('SMTP unavailable')
          }
        }
      })
      await context.runtime.database
        .insertInto('user')
        .values({
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Owner',
          email: 'owner-delivery@example.com',
          emailVerified: true,
          image: null
        })
        .execute()
      const workspace = await context.runtime.database
        .selectFrom('document')
        .select('workspaceId')
        .where('id', '=', context.documentId)
        .executeTakeFirstOrThrow()
      await context.runtime.database
        .updateTable('workspaceMember')
        .set({ userId: '11111111-1111-4111-8111-111111111111' })
        .where('workspaceId', '=', workspace.workspaceId)
        .where('userId', '=', 'owner')
        .execute()
      await expect(
        sharing.createInvitation('11111111-1111-4111-8111-111111111111', context.documentId, {
          email: 'failed@example.com',
          permission: 'view'
        })
      ).rejects.toThrow('Invitation delivery failed')
      const row = await context.runtime.database
        .selectFrom('documentInvitation')
        .select(['id', 'revokedAt'])
        .where('emailNormalized', '=', 'failed@example.com')
        .executeTakeFirstOrThrow()
      expect(row.revokedAt).not.toBeNull()
    } finally {
      await context.runtime.close()
    }
  })

  test('prevents viewers from managing sharing', async () => {
    const context = await seed()
    try {
      await expect(
        context.sharing.createShare('viewer', context.documentId, { permission: 'view' })
      ).rejects.toBeInstanceOf(DocumentForbiddenError)
    } finally {
      await context.runtime.close()
    }
  })
})
