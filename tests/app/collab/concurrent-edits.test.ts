import { describe, expect, test } from 'bun:test'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'
import { type SyncedStores, withSyncedStores } from '#tests/helpers/collab/synced-stores'
import { connectYDocs } from '#tests/helpers/yjs'

/** Edit both peers while their documents are disconnected, then reconnect them. */
async function withConcurrentEdits(
  seed: (graph: SceneGraph, pageId: string) => void,
  edit: (stores: SyncedStores, pageId: string) => void,
  check: (stores: SyncedStores, pageId: string) => void
) {
  await withSyncedStores(
    (stores) => {
      const pageId = expectDefined(stores.hostStore.graph.getPages()[0], 'first page').id
      seed(stores.hostStore.graph, pageId)
      stores.hostSync.syncAllNodesToYjs()
      expectDefined(stores.disconnectYDocs, 'connected peers to disconnect')()
      edit(stores, pageId)
      const disconnect = connectYDocs(stores.hostDoc, stores.peerDoc)
      try {
        check(stores, pageId)
      } finally {
        disconnect()
      }
    },
    { bindGraphEvents: true }
  )
}

describe('collab concurrent edits', () => {
  test('concurrent additions to one parent keep both nodes on both peers', async () => {
    await withConcurrentEdits(
      () => undefined,
      ({ hostStore, peerStore }, pageId) => {
        hostStore.graph.createNode('RECTANGLE', pageId, { id: 'host:1' })
        peerStore.graph.createNode('RECTANGLE', pageId, { id: 'peer:1' })
      },
      ({ hostStore, peerStore }, pageId) => {
        for (const graph of [hostStore.graph, peerStore.graph]) {
          expect(getNodeOrThrow(graph, 'host:1').parentId).toBe(pageId)
          expect(getNodeOrThrow(graph, 'peer:1').parentId).toBe(pageId)
          expect(getNodeOrThrow(graph, pageId).childIds).toEqual(
            expect.arrayContaining(['host:1', 'peer:1'])
          )
        }
      }
    )
  })

  test('concurrent writes to one property converge to the same value', async () => {
    await withConcurrentEdits(
      (graph, pageId) => {
        graph.createNode('RECTANGLE', pageId, { id: 'rect:1' })
      },
      ({ hostStore, peerStore }) => {
        hostStore.graph.updateNode('rect:1', { x: 10 })
        peerStore.graph.updateNode('rect:1', { x: 20 })
      },
      ({ hostStore, peerStore }) => {
        const x = getNodeOrThrow(hostStore.graph, 'rect:1').x
        expect([10, 20]).toContain(x)
        expect(getNodeOrThrow(peerStore.graph, 'rect:1').x).toBe(x)
      }
    )
  })

  test('a deletion wins over a concurrent edit of the deleted node', async () => {
    await withConcurrentEdits(
      (graph, pageId) => {
        graph.createNode('RECTANGLE', pageId, { id: 'rect:1' })
      },
      ({ hostStore, peerStore }) => {
        hostStore.graph.deleteNode('rect:1')
        peerStore.graph.updateNode('rect:1', { x: 20 })
      },
      ({ hostStore, peerStore }, pageId) => {
        for (const graph of [hostStore.graph, peerStore.graph]) {
          expect(graph.getNode('rect:1')).toBeUndefined()
          expect(getNodeOrThrow(graph, pageId).childIds).not.toContain('rect:1')
        }
      }
    )
  })
})
