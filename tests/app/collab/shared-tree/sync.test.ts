import { describe, expect, test } from 'bun:test'

import type * as Y from 'yjs'

import { captureGraphCheckpoint } from '@open-pencil/scene-graph'

import { readPage } from '@/app/collab/shared-tree/fields'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'
import {
  expectSameLayerTree,
  settleGraphSync,
  type SyncedStores,
  withSyncedStores
} from '#tests/helpers/collab/synced-stores'
import { connectYDocs } from '#tests/helpers/yjs'

/** Seeds layers on the host page, syncs them, and runs a live edit on connected peers. */
async function withLiveEdit(
  seed: (stores: SyncedStores, pageId: string) => void,
  edit: (stores: SyncedStores, pageId: string) => void,
  check: (stores: SyncedStores, pageId: string) => void
) {
  await withSyncedStores(
    async (stores) => {
      const pageId = expectDefined(stores.hostStore.graph.getPages()[0], 'first page').id
      seed(stores, pageId)
      stores.hostSync.syncAllNodesToYjs()
      await settleGraphSync()
      edit(stores, pageId)
      await settleGraphSync()
      check(stores, pageId)
    },
    { bindGraphEvents: true }
  )
}

describe('collab layer tree', () => {
  test('moving a layer updates both parents on the other peer', async () => {
    await withLiveEdit(
      ({ hostStore }, pageId) => {
        hostStore.graph.createNode('FRAME', pageId, { id: 'frame:1' })
        hostStore.graph.createNode('RECTANGLE', pageId, { id: 'rect:1' })
      },
      ({ hostStore }) => {
        hostStore.graph.reparentNode('rect:1', 'frame:1')
      },
      (stores, pageId) => {
        const peer = stores.peerStore.graph
        expect(getNodeOrThrow(peer, pageId).childIds).not.toContain('rect:1')
        expect(getNodeOrThrow(peer, 'frame:1').childIds).toEqual(['rect:1'])
        expectSameLayerTree(stores, [pageId])
      }
    )
  })

  test('reordering layers within a parent syncs their order', async () => {
    await withLiveEdit(
      ({ hostStore }, pageId) => {
        for (const id of ['rect:1', 'rect:2', 'rect:3']) {
          hostStore.graph.createNode('RECTANGLE', pageId, { id })
        }
      },
      ({ hostStore }, pageId) => {
        hostStore.graph.reorderChild('rect:3', pageId, 0)
      },
      (stores, pageId) => {
        expect(getNodeOrThrow(stores.peerStore.graph, pageId).childIds).toEqual([
          'rect:3',
          'rect:1',
          'rect:2'
        ])
        expectSameLayerTree(stores, [pageId])
      }
    )
  })

  test('layers created on the peer keep their order on the host', async () => {
    await withLiveEdit(
      () => undefined,
      ({ peerStore }, pageId) => {
        for (const id of ['rect:3', 'rect:1', 'rect:2']) {
          peerStore.graph.createNode('RECTANGLE', pageId, { id })
        }
      },
      (stores, pageId) => {
        expect(getNodeOrThrow(stores.hostStore.graph, pageId).childIds).toEqual([
          'rect:3',
          'rect:1',
          'rect:2'
        ])
        expectSameLayerTree(stores, [pageId])
      }
    )
  })

  test('undo and redo of a move reach the other peer', async () => {
    await withSyncedStores(
      async (stores) => {
        const { hostStore, peerStore } = stores
        const pageId = expectDefined(hostStore.graph.getPages()[0], 'first page').id
        hostStore.graph.createNode('FRAME', pageId, { id: 'frame:1' })
        hostStore.graph.createNode('RECTANGLE', pageId, { id: 'rect:1' })
        hostStore.graph.createNode('RECTANGLE', pageId, { id: 'rect:2' })
        stores.hostSync.syncAllNodesToYjs()
        await settleGraphSync()

        hostStore.reorderChildWithUndo('rect:1', 'frame:1', 0)
        await settleGraphSync()
        hostStore.undoAction()
        await settleGraphSync()
        expect(getNodeOrThrow(peerStore.graph, 'rect:1').parentId).toBe(pageId)
        expect(getNodeOrThrow(peerStore.graph, pageId).childIds).toEqual([
          'frame:1',
          'rect:1',
          'rect:2'
        ])

        hostStore.redoAction()
        await settleGraphSync()
        expect(getNodeOrThrow(peerStore.graph, 'rect:1').parentId).toBe('frame:1')
        expectSameLayerTree(stores, [pageId])
      },
      { bindGraphEvents: true }
    )
  })

  test('a checkpoint rollback moves restored layers back on the other peer', async () => {
    await withSyncedStores(
      async (stores) => {
        const { hostStore, peerStore } = stores
        const pageId = expectDefined(hostStore.graph.getPages()[0], 'first page').id
        hostStore.graph.createNode('FRAME', pageId, { id: 'frame:1' })
        hostStore.graph.createNode('RECTANGLE', pageId, { id: 'rect:1' })
        hostStore.graph.createNode('RECTANGLE', pageId, { id: 'rect:2' })
        stores.hostSync.syncAllNodesToYjs()
        await settleGraphSync()

        const checkpoint = captureGraphCheckpoint(hostStore.graph)
        hostStore.graph.reparentNode('rect:1', 'frame:1')
        hostStore.graph.reorderChild('rect:2', pageId, 0)
        await settleGraphSync()
        expect(getNodeOrThrow(peerStore.graph, 'rect:1').parentId).toBe('frame:1')

        // The restore assigns parentId and childIds directly and reports them as updates.
        checkpoint.restore()
        await settleGraphSync()
        expect(getNodeOrThrow(peerStore.graph, 'rect:1').parentId).toBe(pageId)
        expect(getNodeOrThrow(peerStore.graph, pageId).childIds).toEqual([
          'frame:1',
          'rect:1',
          'rect:2'
        ])
        expectSameLayerTree(stores, [pageId])
      },
      { bindGraphEvents: true }
    )
  })

  test('an edit that moves several layers sends one update', async () => {
    await withSyncedStores(
      async (stores) => {
        const { hostStore, peerStore, hostDoc } = stores
        const pageId = expectDefined(hostStore.graph.getPages()[0], 'first page').id
        hostStore.graph.createNode('FRAME', pageId, { id: 'frame:1' })
        for (const id of ['rect:1', 'rect:2', 'rect:3']) {
          hostStore.graph.createNode('RECTANGLE', pageId, { id })
        }
        stores.hostSync.syncAllNodesToYjs()
        await settleGraphSync()

        let updates = 0
        const count = () => updates++
        hostDoc.on('update', count)
        try {
          hostStore.reparentNodes(['rect:1', 'rect:2', 'rect:3'], 'frame:1')
          await settleGraphSync()
        } finally {
          hostDoc.off('update', count)
        }
        expect(updates).toBe(1)
        expect(getNodeOrThrow(peerStore.graph, 'frame:1').childIds).toEqual([
          'rect:1',
          'rect:2',
          'rect:3'
        ])
      },
      { bindGraphEvents: true }
    )
  })

  test("a joiner's edit to its own earlier document leaves the room's pages alone", async () => {
    await withSyncedStores(
      async ({ hostStore, peerStore, hostSync }) => {
        const peerOwnPage = expectDefined(peerStore.graph.getPages()[0], 'peer page').id
        const hostRoot = hostStore.graph.rootId
        const hostPages = hostStore.graph.getPages().map((page) => page.id)
        hostSync.syncAllNodesToYjs()
        await settleGraphSync()
        expect(peerStore.graph.rootId).toBe(hostRoot)

        // An undo of an edit made before joining can still reach the joiner's own page.
        peerStore.graph.createNode('RECTANGLE', peerOwnPage, { id: 'rect:1' })
        await settleGraphSync()
        for (const graph of [hostStore.graph, peerStore.graph]) {
          expect(graph.rootId).toBe(hostRoot)
          expect(graph.getPages().map((page) => page.id)).toEqual(hostPages)
        }
        expect(hostStore.graph.getNode('rect:1')).toBeUndefined()
      },
      { bindGraphEvents: true }
    )
  })

  test('edits in a room nobody has shared stay local', async () => {
    await withSyncedStores(
      async ({ hostStore, peerStore, hostDoc }) => {
        const pageId = expectDefined(hostStore.graph.getPages()[0], 'first page').id
        hostStore.graph.createNode('RECTANGLE', pageId, { id: 'rect:1' })
        await settleGraphSync()
        expect(hostDoc.getMap('nodes').size).toBe(0)
        expect(peerStore.graph.getNode('rect:1')).toBeUndefined()
      },
      { bindGraphEvents: true }
    )
  })

  test("a joiner who edits before the room reaches them keeps the sharer's root", async () => {
    await withSyncedStores(
      async ({ hostStore, peerStore, hostSync, hostDoc, peerDoc }) => {
        const hostRoot = hostStore.graph.rootId
        const hostPages = hostStore.graph.getPages().map((page) => page.id)
        const peerOwnPage = expectDefined(peerStore.graph.getPages()[0], 'peer page').id
        // The joiner edits first; with nobody's root known yet, the edit stays on their device.
        peerStore.graph.createNode('RECTANGLE', peerOwnPage, { id: 'rect:1' })
        await settleGraphSync()
        hostSync.syncAllNodesToYjs()

        const disconnect = connectYDocs(hostDoc, peerDoc)
        try {
          await settleGraphSync()
          for (const graph of [hostStore.graph, peerStore.graph]) {
            expect(graph.rootId).toBe(hostRoot)
            expect(graph.getPages().map((page) => page.id)).toEqual(hostPages)
          }
        } finally {
          disconnect()
        }
      },
      { bindGraphEvents: true, connectImmediately: false }
    )
  })

  test('moving a frame to another page records that page for the layers inside it', async () => {
    await withLiveEdit(
      ({ hostStore }, pageId) => {
        hostStore.graph.addPage('Second')
        hostStore.graph.createNode('FRAME', pageId, { id: 'frame:1' })
        hostStore.graph.createNode('RECTANGLE', 'frame:1', { id: 'rect:1' })
      },
      ({ hostStore }) => {
        const secondPageId = expectDefined(hostStore.graph.getPages()[1], 'second page').id
        hostStore.graph.reparentNode('frame:1', secondPageId)
      },
      ({ hostStore, peerDoc }) => {
        const secondPageId = expectDefined(hostStore.graph.getPages()[1], 'second page').id
        const ynodes = peerDoc.getMap<Y.Map<unknown>>('nodes')
        for (const id of ['frame:1', 'rect:1']) {
          expect(readPage(expectDefined(ynodes.get(id), id))).toBe(secondPageId)
        }
      }
    )
  })
})
