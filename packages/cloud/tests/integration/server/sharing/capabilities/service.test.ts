import { describe, expect, test } from 'bun:test'

import { CLOUD_FEATURE_KEYS, seedSharing, sharingWithPolicy } from '#cloud-test/helpers/sharing'

import { DocumentForbiddenError, DocumentShareInvalidError } from '@open-pencil/cloud/server'

describe('document sharing capabilities integration', () => {
  test('creates hash-only capabilities and resolves user and guest principals', async () => {
    const context = await seedSharing()
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
      expect(
        await context.sharing.resolveShare(capability.share.id, {
          secret: capability.secret,
          guestName: 'Visitor'
        })
      ).toMatchObject({
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
    const context = await seedSharing()
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
    const context = await seedSharing()
    try {
      const enabled = sharingWithPolicy(context, {
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
        const disabled = sharingWithPolicy(
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
})
