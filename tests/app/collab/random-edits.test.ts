import { describe, expect, test } from 'bun:test'

import { create as createPRNG, oneOf, real53, type PRNG } from 'lib0/prng'
import { TestConnector, type TestYInstance } from 'yjs/testHelper'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { expectDefined } from '#tests/helpers/assert'
import {
  expectSameLayerTree,
  settleGraphSync,
  withSyncedStores
} from '#tests/helpers/collab/synced-stores'

/** Layers under the page. */
function layersUnder(graph: SceneGraph, pageId: string): string[] {
  return graph.flattenTree(pageId).map((entry) => entry.node.id)
}

/** One random layer edit on a peer, as its user would make it through the graph. */
function randomEdit(random: PRNG, graph: SceneGraph, pageId: string, nextId: () => string) {
  const layers = layersUnder(graph, pageId)
  const frames = [pageId, ...layers.filter((id) => graph.getNode(id)?.type === 'FRAME')]
  const roll = real53(random)
  if (layers.length < 4 || roll < 0.25) {
    graph.createNode(real53(random) < 0.5 ? 'FRAME' : 'RECTANGLE', oneOf(random, frames), {
      id: nextId()
    })
    return
  }
  const id = oneOf(random, layers)
  if (roll < 0.3) {
    graph.deleteNode(id)
  } else if (roll < 0.65) {
    // reparentNode refuses a move into the layer's own subtree, as the editor does.
    graph.reparentNode(id, oneOf(random, frames))
  } else {
    const parentId = expectDefined(graph.getNode(id)?.parentId, 'parent of a layer')
    const siblings = graph.getNode(parentId)?.childIds.length ?? 1
    graph.reorderChild(id, parentId, Math.floor(real53(random) * siblings))
  }
}

describe('collab random concurrent edits', () => {
  for (const seed of [11, 23, 37, 41, 59, 67, 73, 89]) {
    test(`peers converge on one layer tree through the Yjs test connector (seed ${seed})`, async () => {
      const random = createPRNG(seed)
      const connector = new TestConnector(createPRNG(seed))
      const hostDoc: TestYInstance = connector.createY(1)
      const peerDoc: TestYInstance = connector.createY(2)
      connector.syncAll()

      await withSyncedStores(
        async (stores) => {
          const { hostStore, peerStore } = stores
          const pageId = expectDefined(hostStore.graph.getPages()[0], 'first page').id
          stores.hostSync.syncAllNodesToYjs()
          connector.flushAllMessages()
          let counter = 0
          const idFor = (prefix: string) => () => `${prefix}:${++counter}`

          for (let round = 0; round < 6; round++) {
            hostDoc.disconnect()
            peerDoc.disconnect()
            for (let step = 0; step < 8; step++) {
              randomEdit(random, hostStore.graph, pageId, idFor('host'))
              await settleGraphSync()
              randomEdit(random, peerStore.graph, pageId, idFor('peer'))
              await settleGraphSync()
            }
            hostDoc.connect()
            peerDoc.connect()
            while (connector.flushRandomMessage()) await settleGraphSync()
            await settleGraphSync()

            const layers = expectSameLayerTree(stores, [pageId])
            layers.delete(pageId)
            for (const graph of [hostStore.graph, peerStore.graph]) {
              expect([...layers].sort()).toEqual(layersUnder(graph, pageId).sort())
            }
          }
        },
        { hostDoc, peerDoc, connectImmediately: false, bindGraphEvents: true }
      )
    })
  }
})
