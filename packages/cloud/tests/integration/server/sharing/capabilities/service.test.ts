import { describe, expect, test } from 'bun:test'

import { CLOUD_FEATURE_KEYS, seedSharing, sharingWithPolicy } from '#cloud-tests/helpers/sharing'
import {
  DocumentForbiddenError,
  DocumentNotFoundError,
  DocumentShareInvalidError,
  DocumentShareSignInRequiredError
} from '#cloud/server'

describe('document sharing capabilities integration', () => {
  test('stops a link while its maker or its document’s maker is banned', async () => {
    const context = await seedSharing()
    try {
      const maker = crypto.randomUUID()
      await context.runtime.database
        .insertInto('user')
        .values({ id: maker, name: 'Maker', email: 'maker@example.com', emailVerified: true })
        .execute()
      const capability = await context.sharing.createShare('owner', context.documentId, {
        permission: 'view'
      })
      await context.runtime.database
        .updateTable('documentShare')
        .set({ createdBy: maker })
        .where('id', '=', capability.share.id)
        .execute()
      const resolve = () =>
        context.sharing.resolveShare(capability.share.id, { secret: capability.secret })
      const ban = (banExpires: Date | null) =>
        context.runtime.database
          .updateTable('user')
          .set({ banned: true, banExpires })
          .where('id', '=', maker)
          .execute()

      await ban(null)
      await expect(resolve()).rejects.toBeInstanceOf(DocumentShareInvalidError)
      // A ban that runs out later still holds; one that ran out no longer does.
      await ban(new Date(Date.now() + 60_000))
      await expect(resolve()).rejects.toBeInstanceOf(DocumentShareInvalidError)
      await ban(new Date(Date.now() - 1_000))
      await expect(resolve()).resolves.toMatchObject({ documentId: context.documentId })

      // The document's maker counts too, whoever made the link.
      await context.runtime.database
        .updateTable('documentShare')
        .set({ createdBy: 'owner' })
        .where('id', '=', capability.share.id)
        .execute()
      await context.runtime.database
        .updateTable('document')
        .set({ createdBy: maker })
        .where('id', '=', context.documentId)
        .execute()
      await ban(null)
      await expect(resolve()).rejects.toBeInstanceOf(DocumentShareInvalidError)
    } finally {
      await context.runtime.close()
    }
  })

  test('creates hash-only capabilities and resolves user and guest principals', async () => {
    const context = await seedSharing()
    try {
      const capability = await context.sharing.createShare('owner', context.documentId, {
        permission: 'view'
      })
      expect(capability.secret).toMatch(/^[0-9a-f]{48}$/)
      // What goes out names the share; its stored hash stays on the server.
      expect(Object.keys(capability.share)).not.toContain('secretHash')
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

  test('lets edit links exist whatever guests may do, and needs links for any update', async () => {
    const context = await seedSharing()
    try {
      const enabled = sharingWithPolicy(context, {
        [CLOUD_FEATURE_KEYS.links]: true,
        [CLOUD_FEATURE_KEYS.guestEdit]: false
      })
      const capability = await enabled.createShare('owner', context.documentId, {
        permission: 'view'
      })
      expect(
        await enabled.updateShare('owner', context.documentId, capability.share.id, {
          permission: 'edit'
        })
      ).toMatchObject({ permission: 'edit' })
      for (const deploymentMode of ['official', 'self-hosted'] as const) {
        const disabled = sharingWithPolicy(
          context,
          {
            [CLOUD_FEATURE_KEYS.links]: false,
            [CLOUD_FEATURE_KEYS.guestEdit]: true
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

  test('asks guests to sign in where the server turns them away, and lets members in', async () => {
    const context = await seedSharing()
    try {
      const closed = sharingWithPolicy(context, {
        [CLOUD_FEATURE_KEYS.links]: true,
        [CLOUD_FEATURE_KEYS.guestView]: false,
        [CLOUD_FEATURE_KEYS.guestEdit]: false
      })
      for (const permission of ['view', 'edit'] as const) {
        const capability = await closed.createShare('owner', context.documentId, { permission })
        const input = { secret: capability.secret, guestName: 'Visitor' }
        await expect(closed.resolveShare(capability.share.id, input)).rejects.toBeInstanceOf(
          DocumentShareSignInRequiredError
        )
        const member = await closed.resolveShare(capability.share.id, input, {
          userId: 'alice',
          name: 'Alice',
          email: 'alice@example.com'
        })
        expect(member).toMatchObject({ permission, principal: { kind: 'user', userId: 'alice' } })
      }
    } finally {
      await context.runtime.close()
    }
  })

  test('lets guests view an edit link where they may view but not edit', async () => {
    const context = await seedSharing()
    try {
      const viewOnly = sharingWithPolicy(context, {
        [CLOUD_FEATURE_KEYS.links]: true,
        [CLOUD_FEATURE_KEYS.guestView]: true,
        [CLOUD_FEATURE_KEYS.guestEdit]: false
      })
      const capability = await viewOnly.createShare('owner', context.documentId, {
        permission: 'edit'
      })
      const input = { secret: capability.secret, guestName: 'Visitor' }
      expect(await viewOnly.resolveShare(capability.share.id, input)).toMatchObject({
        permission: 'view',
        linkPermission: 'edit',
        principal: { kind: 'guest', name: 'Visitor' }
      })
      expect(
        await viewOnly.resolveShare(capability.share.id, input, {
          userId: 'alice',
          name: 'Alice',
          email: 'alice@example.com'
        })
      ).toMatchObject({ permission: 'edit', linkPermission: 'edit' })

      const open = sharingWithPolicy(context, {
        [CLOUD_FEATURE_KEYS.links]: true,
        [CLOUD_FEATURE_KEYS.guestView]: false,
        [CLOUD_FEATURE_KEYS.guestEdit]: true
      })
      expect(await open.resolveShare(capability.share.id, input)).toMatchObject({
        permission: 'edit',
        linkPermission: 'edit'
      })
    } finally {
      await context.runtime.close()
    }
  })

  test('checks sharing access before it looks up a share to update', async () => {
    const context = await seedSharing()
    try {
      const capability = await context.sharing.createShare('owner', context.documentId, {
        permission: 'view'
      })
      await expect(
        context.sharing.updateShare('viewer', context.documentId, capability.share.id, {
          expiresAt: null
        })
      ).rejects.toBeInstanceOf(DocumentForbiddenError)
      await expect(
        context.sharing.updateShare('owner', context.documentId, crypto.randomUUID(), {
          expiresAt: null
        })
      ).rejects.toBeInstanceOf(DocumentNotFoundError)
    } finally {
      await context.runtime.close()
    }
  })
})
