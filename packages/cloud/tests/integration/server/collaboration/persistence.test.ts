import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'
import * as Y from 'yjs'

import { createCollaborationStateStore } from '@open-pencil/cloud/server'

const documentId = '11111111-1111-4111-8111-111111111111'

async function seed() {
  const runtime = await createCloudTestDatabase()
  const workspaceId = crypto.randomUUID()
  await runtime.database
    .insertInto('workspace')
    .values({
      id: workspaceId,
      name: 'Workspace',
      slug: `workspace-${workspaceId}`,
      createdBy: 'u'
    })
    .execute()
  await runtime.database
    .insertInto('document')
    .values({ id: documentId, workspaceId, name: 'Document', createdBy: 'u' })
    .execute()
  return runtime
}

describe('collaboration state persistence', () => {
  test('stores compact Yjs state by document epoch and reloads it', async () => {
    const runtime = await seed()
    try {
      const store = createCollaborationStateStore(runtime.database)
      const source = new Y.Doc()
      source.getMap('nodes').set('node-1', { name: 'Rectangle' })
      await store.store(`cloud:${documentId}:2`, source)
      const update = await store.load(`cloud:${documentId}:2`)
      expect(update).not.toBeNull()
      const restored = new Y.Doc()
      if (update) Y.applyUpdate(restored, update)
      expect(restored.getMap('nodes').get('node-1')).toEqual({ name: 'Rectangle' })
      expect(await store.load(`cloud:${documentId}:3`)).toBeNull()
    } finally {
      await runtime.close()
    }
  })
})
