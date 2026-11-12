import { describe, expect, test } from 'bun:test'

import { DAY_MS, people, trashApp } from '#cloud-tests/helpers/trash'

describe('Cloud Trash', () => {
  test('lists deleted documents with who deleted them, and restores them', async () => {
    const context = await trashApp()
    try {
      const kept = await context.create('Kept')
      const deleted = await context.create('Landing page')
      await context.remove(deleted)
      expect(await context.listed()).toEqual([kept])

      const [entry, ...rest] = await context.trash()
      expect(rest).toEqual([])
      expect(entry).toMatchObject({
        id: deleted,
        workspaceId: context.workspaceId,
        workspaceName: 'Studio',
        name: 'Landing page',
        kind: 'design',
        deletedBy: { name: 'Alice' },
        canPurge: true
      })
      if (!entry) throw new Error('Expected the deleted document in Trash')
      expect(Date.parse(entry.purgeAt) - Date.parse(entry.deletedAt)).toBe(30 * DAY_MS)

      expect((await context.restore(deleted)).status).toBe(204)
      expect(await context.trash()).toEqual([])
      expect((await context.listed()).toSorted()).toEqual([kept, deleted].toSorted())
      const restored = await context.runtime.database
        .selectFrom('document')
        .select(['deletedAt', 'deletedBy'])
        .where('id', '=', deleted)
        .executeTakeFirstOrThrow()
      expect(restored).toEqual({ deletedAt: null, deletedBy: null })
    } finally {
      await context.runtime.close()
    }
  })

  test('keeps documents past retention, or being cleaned, out of reach', async () => {
    const context = await trashApp()
    try {
      const expired = await context.create('Expired')
      const claimed = await context.create('Claimed')
      await context.remove(expired)
      await context.remove(claimed)
      await context.deletedAgo(expired, 30 * DAY_MS + 60_000)
      await context.runtime.database
        .updateTable('document')
        .set({ cleanupClaimId: crypto.randomUUID(), cleanupClaimedAt: new Date() })
        .where('id', '=', claimed)
        .execute()

      expect(await context.trash()).toEqual([])
      expect((await context.restore(expired)).status).toBe(404)
      expect((await context.restore(claimed)).status).toBe(404)
      expect(await context.listed()).toEqual([])
    } finally {
      await context.runtime.close()
    }
  })

  test('lets whoever may delete a document restore it, and only its owner or an admin purge it', async () => {
    const context = await trashApp({ roles: { bob: 'editor', carol: 'viewer' } })
    try {
      const document = await context.create('Shared')
      await context.remove(document)

      context.as('carol')
      expect(await context.trash()).toEqual([])
      expect((await context.restore(document)).status).toBe(404)
      expect((await context.purge(document)).status).toBe(404)

      context.as('bob')
      const [seen] = await context.trash()
      expect(seen).toMatchObject({ id: document, canPurge: false })
      expect((await context.purge(document)).status).toBe(403)
      expect((await context.restore(document)).status).toBe(204)

      // An editor's own document is theirs to delete for good.
      const own = await context.create('Bob’s draft')
      await context.remove(own)
      expect(await context.trash()).toMatchObject([
        { id: own, deletedBy: { name: 'Bob' }, canPurge: true }
      ])
      expect((await context.purge(own)).status).toBe(204)

      // Someone removed from the workspace sees nothing of its Trash.
      await context.remove(document)
      await context.runtime.database
        .deleteFrom('workspaceMember')
        .where('userId', '=', people.bob.userId)
        .execute()
      expect(await context.trash()).toEqual([])
      expect((await context.restore(document)).status).toBe(404)
    } finally {
      await context.runtime.close()
    }
  })

  test('refuses to purge a live document', async () => {
    const context = await trashApp()
    try {
      const document = await context.create('Live')
      expect((await context.purge(document)).status).toBe(404)
      expect((await context.restore(document)).status).toBe(404)
      expect(await context.listed()).toEqual([document])
    } finally {
      await context.runtime.close()
    }
  })
})
