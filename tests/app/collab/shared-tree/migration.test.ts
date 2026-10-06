import { describe, expect, test } from 'bun:test'

import * as Y from 'yjs'

import { SceneGraph } from '@open-pencil/scene-graph'

import { encodeNodeForYjs } from '@/app/collab/node-codec'
import {
  claimRoot,
  readOrderKey,
  readPage,
  readParentEntries,
  readRoot,
  TREE_FORMAT
} from '@/app/collab/shared-tree/fields'
import { migrateLegacyLayers } from '@/app/collab/shared-tree/migration'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'
import {
  expectSameLayerTree,
  settleGraphSync,
  type SyncedStores,
  withSyncedStores
} from '#tests/helpers/collab/synced-stores'
import { connectYDocs } from '#tests/helpers/yjs'

/** A document as format 1 wrote it: each layer's map holds its parentId and childIds. */
function legacyDocument(): { update: Uint8Array; graph: SceneGraph; pageId: string } {
  const graph = new SceneGraph()
  const pageId = expectDefined(graph.getPages()[0], 'first page').id
  graph.createNode('FRAME', pageId, { id: 'frame:1' })
  graph.createNode('RECTANGLE', 'frame:1', { id: 'rect:2' })
  graph.createNode('RECTANGLE', 'frame:1', { id: 'rect:1' })
  graph.createNode('RECTANGLE', pageId, { id: 'rect:3' })
  graph.reorderChild('rect:3', pageId, 0)

  const doc = new Y.Doc()
  const ynodes = doc.getMap<Y.Map<unknown>>('nodes')
  doc.transact(() => {
    for (const node of graph.getAllNodes()) {
      const ynode = new Y.Map<unknown>()
      ynodes.set(node.id, ynode)
      for (const [key, value] of Object.entries(encodeNodeForYjs(node))) ynode.set(key, value)
      ynode.set('parentId', node.parentId)
      ynode.set('childIds', [...node.childIds])
    }
  })
  const update = Y.encodeStateAsUpdate(doc)
  doc.destroy()
  return { update, graph, pageId }
}

function expectMatchesLegacy(graph: SceneGraph, legacy: SceneGraph) {
  for (const node of legacy.getAllNodes()) {
    const synced = getNodeOrThrow(graph, node.id)
    expect(synced.parentId).toBe(node.parentId)
    expect(synced.childIds).toEqual(node.childIds)
  }
}

function sharedTreeFields(doc: Y.Doc) {
  const fields: Record<string, unknown> = {}
  for (const [id, ynode] of doc.getMap<Y.Map<unknown>>('nodes')) {
    fields[id] = {
      parents: Object.fromEntries(readParentEntries(ynode) ?? []),
      orderKey: readOrderKey(ynode),
      page: readPage(ynode),
      legacy: ynode.has('parentId') || ynode.has('childIds')
    }
  }
  return fields
}

async function withLegacyRoom(run: (stores: SyncedStores) => void | Promise<void>) {
  await withSyncedStores(run, { connectImmediately: false })
}

describe('collab tree format migration', () => {
  test('opening a format 1 document converts its tree and keeps it', async () => {
    const legacy = legacyDocument()
    await withLegacyRoom(({ hostStore, hostDoc }) => {
      Y.applyUpdate(hostDoc, legacy.update)

      expectMatchesLegacy(hostStore.graph, legacy.graph)
      expect(hostStore.graph.rootId).toBe(legacy.graph.rootId)
      expect(readRoot(hostDoc.getMap('meta'))).toBe(legacy.graph.rootId)
      expect(hostDoc.getMap('meta').get('treeFormat')).toBe(TREE_FORMAT)
      const fields = sharedTreeFields(hostDoc)
      expect(fields['rect:2']).toMatchObject({
        parents: { 'frame:1': 0 },
        page: legacy.pageId,
        legacy: false
      })
      expect(fields['rect:3']).toMatchObject({ page: legacy.pageId })
      expect(fields[legacy.pageId]).toMatchObject({ page: undefined })
      expect(fields[legacy.graph.rootId]).toMatchObject({ parents: {}, legacy: false })
      const first = expectDefined(readOrderKey(getYnode(hostDoc, 'rect:2')), 'first key')
      const second = expectDefined(readOrderKey(getYnode(hostDoc, 'rect:1')), 'second key')
      expect(first < second).toBe(true)
    })
  })

  test('two peers converting the same document at once write the same tree', async () => {
    const legacy = legacyDocument()
    await withLegacyRoom(async (stores) => {
      const { hostStore, peerStore, hostDoc, peerDoc } = stores
      Y.applyUpdate(hostDoc, legacy.update)
      Y.applyUpdate(peerDoc, legacy.update)
      expect(sharedTreeFields(peerDoc)).toEqual(sharedTreeFields(hostDoc))

      const disconnect = connectYDocs(hostDoc, peerDoc)
      try {
        await settleGraphSync()
        expectSameLayerTree(stores, [legacy.pageId])
        expectMatchesLegacy(hostStore.graph, legacy.graph)
        expectMatchesLegacy(peerStore.graph, legacy.graph)
      } finally {
        disconnect()
      }
    })
  })

  test('a converted layer moves like any other', async () => {
    const legacy = legacyDocument()
    await withSyncedStores(
      async (stores) => {
        const { hostStore, peerStore, hostDoc } = stores
        Y.applyUpdate(hostDoc, legacy.update)
        hostStore.graph.reparentNode('rect:3', 'frame:1')
        await settleGraphSync()
        expect(getNodeOrThrow(peerStore.graph, 'rect:3').parentId).toBe('frame:1')
        expectSameLayerTree(stores, [legacy.pageId])
      },
      { bindGraphEvents: true }
    )
  })

  test('converting an already converted document writes nothing', async () => {
    const legacy = legacyDocument()
    await withLegacyRoom(({ hostDoc }) => {
      Y.applyUpdate(hostDoc, legacy.update)
      let updates = 0
      const count = () => updates++
      hostDoc.on('update', count)
      const ynodes = hostDoc.getMap<Y.Map<unknown>>('nodes')
      const migrated = migrateLegacyLayers(hostDoc, ynodes, hostDoc.getMap('meta'), ynodes.keys())
      hostDoc.off('update', count)
      expect(migrated).toEqual([])
      expect(updates).toBe(0)
    })
  })

  test('converting a room keeps a root already shared into it', () => {
    const legacy = legacyDocument()
    const doc = new Y.Doc()
    const meta = doc.getMap('meta')
    claimRoot(meta, 'shared-root')
    Y.applyUpdate(doc, legacy.update)
    const ynodes = doc.getMap<Y.Map<unknown>>('nodes')
    migrateLegacyLayers(doc, ynodes, meta, ynodes.keys())
    expect(readRoot(meta)).toBe('shared-root')
  })
})

function getYnode(doc: Y.Doc, id: string): Y.Map<unknown> {
  return expectDefined(doc.getMap<Y.Map<unknown>>('nodes').get(id), `ynode ${id}`)
}
