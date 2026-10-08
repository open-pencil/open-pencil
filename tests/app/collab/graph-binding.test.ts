import { describe, expect, test } from 'bun:test'

import type * as Y from 'yjs'

import { bindCollabGraphEvents } from '@/app/collab/yjs-sync'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'
import { settleGraphSync, withSyncedStores } from '#tests/helpers/collab/synced-stores'

describe('collab graph binding', () => {
  test('an edit made just before leaving still reaches the room', async () => {
    await withSyncedStores(async (stores) => {
      const { hostStore, peerStore, hostSync, hostDoc } = stores
      hostSync.syncAllNodesToYjs()
      await settleGraphSync()
      const unbind = bindCollabGraphEvents({
        store: hostStore,
        getYdoc: () => hostDoc,
        getYnodes: () => hostDoc.getMap<Y.Map<unknown>>('nodes'),
        getSuppressGraphSync: () => stores.hostSuppressGraphSync,
        syncLocalEdit: hostSync.syncLocalEdit
      })
      const pageId = expectDefined(hostStore.graph.getPages()[0], 'first page').id
      hostStore.graph.createNode('RECTANGLE', pageId, { id: 'rect:1' })
      // Leaving before the edit's batch is written, as disconnecting can.
      unbind()
      await settleGraphSync()
      expect(getNodeOrThrow(peerStore.graph, 'rect:1').parentId).toBe(pageId)
    })
  })
})
