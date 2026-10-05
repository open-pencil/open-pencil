import { describe, expect, test } from 'bun:test'

import type * as Y from 'yjs'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'
import {
  expectSameLayerTree,
  settleGraphSync,
  type SyncedStores,
  withSyncedStores
} from '#tests/helpers/collab/synced-stores'
import { connectYDocs } from '#tests/helpers/yjs'

/** Edit both peers while their documents are disconnected, then reconnect them. */
async function withConcurrentEdits(
  seed: (graph: SceneGraph, pageId: string) => void,
  edit: (stores: SyncedStores, pageId: string) => void,
  check: (stores: SyncedStores, pageId: string) => void
) {
  await withSyncedStores(
    async (stores) => {
      const pageId = expectDefined(stores.hostStore.graph.getPages()[0], 'first page').id
      seed(stores.hostStore.graph, pageId)
      stores.hostSync.syncAllNodesToYjs()
      await settleGraphSync()
      expectDefined(stores.disconnectYDocs, 'connected peers to disconnect')()
      edit(stores, pageId)
      await settleGraphSync()
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

function secondPageOf(graph: SceneGraph): string {
  return expectDefined(graph.getPages()[1], 'second page').id
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
  test('concurrent additions to one parent converge on the same layer order', async () => {
    await withConcurrentEdits(
      (graph, pageId) => {
        graph.createNode('RECTANGLE', pageId, { id: 'seed:1' })
      },
      ({ hostStore, peerStore }, pageId) => {
        hostStore.graph.createNode('RECTANGLE', pageId, { id: 'host:1' })
        peerStore.graph.createNode('RECTANGLE', pageId, { id: 'peer:1' })
      },
      (stores, pageId) => {
        const layers = expectSameLayerTree(stores, [pageId])
        expect([...layers]).toEqual(expect.arrayContaining(['seed:1', 'host:1', 'peer:1']))
      }
    )
  })

  test('moving two layers into each other at once converges on one acyclic tree', async () => {
    await withConcurrentEdits(
      (graph, pageId) => {
        graph.createNode('FRAME', pageId, { id: 'frame:a' })
        graph.createNode('FRAME', pageId, { id: 'frame:b' })
      },
      ({ hostStore, peerStore }) => {
        hostStore.graph.reparentNode('frame:a', 'frame:b')
        peerStore.graph.reparentNode('frame:b', 'frame:a')
      },
      (stores, pageId) => {
        const layers = expectSameLayerTree(stores, [pageId])
        expect([...layers]).toEqual(expect.arrayContaining(['frame:a', 'frame:b']))
        // Both moves share a counter, so the move of the higher layer id is the one undone.
        const host = stores.hostStore.graph
        expect(getNodeOrThrow(host, 'frame:a').parentId).toBe('frame:b')
        expect(getNodeOrThrow(host, 'frame:b').parentId).toBe(pageId)
      }
    )
  })

  test('concurrent moves of one layer settle on one parent on both peers', async () => {
    await withConcurrentEdits(
      (graph, pageId) => {
        for (const id of ['frame:a', 'frame:b', 'rect:1']) {
          graph.createNode(id === 'rect:1' ? 'RECTANGLE' : 'FRAME', pageId, { id })
        }
      },
      ({ hostStore, peerStore }) => {
        hostStore.graph.reparentNode('rect:1', 'frame:a')
        peerStore.graph.reparentNode('rect:1', 'frame:b')
      },
      (stores, pageId) => {
        expectSameLayerTree(stores, [pageId])
        // Equal counters: the higher parent id wins.
        expect(getNodeOrThrow(stores.hostStore.graph, 'rect:1').parentId).toBe('frame:b')
        expect(getNodeOrThrow(stores.hostStore.graph, 'frame:a').childIds).toEqual([])
      }
    )
  })

  test('three layers moved into a loop by two peers drop only the latest move', async () => {
    await withConcurrentEdits(
      (graph, pageId) => {
        for (const id of ['frame:a', 'frame:b', 'frame:c'])
          graph.createNode('FRAME', pageId, { id })
      },
      ({ hostStore, peerStore }) => {
        hostStore.graph.reparentNode('frame:a', 'frame:b')
        peerStore.graph.reparentNode('frame:b', 'frame:c')
        peerStore.graph.reparentNode('frame:c', 'frame:a')
      },
      (stores, pageId) => {
        const layers = expectSameLayerTree(stores, [pageId])
        expect([...layers]).toEqual(expect.arrayContaining(['frame:a', 'frame:b', 'frame:c']))
        const host = stores.hostStore.graph
        expect(getNodeOrThrow(host, 'frame:a').parentId).toBe('frame:b')
        expect(getNodeOrThrow(host, 'frame:b').parentId).toBe('frame:c')
        expect(getNodeOrThrow(host, 'frame:c').parentId).toBe(pageId)
      }
    )
  })

  test('a layer moved into a parent deleted at the same time returns to its previous parent', async () => {
    await withConcurrentEdits(
      (graph, pageId) => {
        graph.createNode('FRAME', pageId, { id: 'frame:1' })
        graph.createNode('FRAME', pageId, { id: 'frame:2' })
        graph.createNode('RECTANGLE', 'frame:1', { id: 'rect:1' })
      },
      ({ hostStore, peerStore }) => {
        hostStore.graph.reparentNode('rect:1', 'frame:2')
        peerStore.graph.deleteNode('frame:2')
      },
      (stores, pageId) => {
        expectSameLayerTree(stores, [pageId])
        for (const graph of [stores.hostStore.graph, stores.peerStore.graph]) {
          expect(graph.getNode('frame:2')).toBeUndefined()
          expect(getNodeOrThrow(graph, 'rect:1').parentId).toBe('frame:1')
        }
      }
    )
  })

  test('a layer whose parents were all deleted goes back to its own page', async () => {
    await withConcurrentEdits(
      (graph) => {
        graph.addPage('Second')
        graph.createNode('FRAME', secondPageOf(graph), { id: 'frame:1' })
      },
      ({ hostStore, peerStore }) => {
        hostStore.graph.createNode('RECTANGLE', 'frame:1', { id: 'rect:1' })
        peerStore.graph.deleteNode('frame:1')
      },
      (stores, pageId) => {
        const secondPageId = secondPageOf(stores.hostStore.graph)
        expectSameLayerTree(stores, [pageId, secondPageId])
        for (const graph of [stores.hostStore.graph, stores.peerStore.graph]) {
          expect(getNodeOrThrow(graph, 'rect:1').parentId).toBe(secondPageId)
        }
      }
    )
  })

  test('inserts at the same spot keep both layers in one order with distinct keys', async () => {
    await withConcurrentEdits(
      (graph, pageId) => {
        graph.createNode('RECTANGLE', pageId, { id: 'rect:1' })
        graph.createNode('RECTANGLE', pageId, { id: 'rect:2' })
      },
      ({ hostStore, peerStore }, pageId) => {
        const host = hostStore.graph.createNode('RECTANGLE', pageId, { id: 'host:1' })
        hostStore.graph.reorderChild(host.id, pageId, 1)
        const peer = peerStore.graph.createNode('RECTANGLE', pageId, { id: 'peer:1' })
        peerStore.graph.reorderChild(peer.id, pageId, 1)
      },
      (stores, pageId) => {
        expectSameLayerTree(stores, [pageId])
        const order = getNodeOrThrow(stores.hostStore.graph, pageId).childIds
        expect(order[0]).toBe('rect:1')
        expect(order[3]).toBe('rect:2')
        expect(order.slice(1, 3)).toEqual(expect.arrayContaining(['host:1', 'peer:1']))
        const ynodes = stores.hostDoc.getMap<Y.Map<unknown>>('nodes')
        const keys = order.map((id) => ynodes.get(id)?.get('orderKey'))
        expect(new Set(keys).size).toBe(4)
      }
    )
  })

  test('concurrent reorders of one parent converge on one order', async () => {
    await withConcurrentEdits(
      (graph, pageId) => {
        for (const id of ['rect:1', 'rect:2', 'rect:3', 'rect:4']) {
          graph.createNode('RECTANGLE', pageId, { id })
        }
      },
      ({ hostStore, peerStore }, pageId) => {
        hostStore.graph.reorderChild('rect:4', pageId, 0)
        peerStore.graph.reorderChild('rect:1', pageId, 3)
        peerStore.graph.reorderChild('rect:4', pageId, 2)
      },
      (stores, pageId) => {
        const layers = expectSameLayerTree(stores, [pageId])
        expect([...layers]).toEqual(
          expect.arrayContaining(['rect:1', 'rect:2', 'rect:3', 'rect:4'])
        )
      }
    )
  })

  test('a layer kept out of a loop stays put when the other layer moves away', async () => {
    await withConcurrentEdits(
      (graph, pageId) => {
        graph.createNode('FRAME', pageId, { id: 'frame:a' })
        graph.createNode('FRAME', pageId, { id: 'frame:b' })
      },
      ({ hostStore, peerStore }) => {
        hostStore.graph.reparentNode('frame:a', 'frame:b')
        peerStore.graph.reparentNode('frame:b', 'frame:a')
      },
      (stores, pageId) => {
        const host = stores.hostStore.graph
        expect(getNodeOrThrow(host, 'frame:b').parentId).toBe(pageId)
        // frame:b's newest entry is frame:a; moving frame:a out of frame:b must not revive it.
        host.reparentNode('frame:a', pageId)
        stores.hostSync.syncNodeToYjs('frame:a')
        expectSameLayerTree(stores, [pageId])
        expect(getNodeOrThrow(host, 'frame:b').parentId).toBe(pageId)
        expect(getNodeOrThrow(stores.peerStore.graph, 'frame:b').parentId).toBe(pageId)
      }
    )
  })
})
