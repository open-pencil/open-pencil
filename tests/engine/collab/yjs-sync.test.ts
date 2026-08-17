import { describe, test, expect } from 'bun:test'

import { create as createPRNG } from 'lib0/prng'
import * as Y from 'yjs'
import { TestConnector, type TestYInstance } from 'yjs/testHelper'

import type { Fill, GeometryPath, SceneNode } from '@open-pencil/scene-graph'
import { SceneGraph } from '@open-pencil/scene-graph'
import { nodeVisualBounds } from '@open-pencil/scene-graph/geometry'
import { createDefaultSourceMetadata } from '@open-pencil/scene-graph/node-defaults'

import { decodeNodeFromYjs, syncEncodedNodeToYMap } from '@/app/collab/node-codec'
import { createYjsGraphSync, registerYjsObservers } from '@/app/collab/yjs-sync'
import { createEditorStore } from '@/app/editor/session'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'
import { connectYDocs } from '#tests/helpers/yjs'

// Test copy of the private apply path.
function applyYnodeToGraph(peer: SceneGraph, nodeId: string, ynode: Y.Map<unknown>) {
  const props = decodeNodeFromYjs(ynode)
  if (peer.getNode(nodeId)) {
    peer.updateNode(nodeId, props as Partial<SceneNode>)
    return
  }
  const type = props.type as SceneNode['type'] | undefined
  if (!type) return
  const parentId = typeof props.parentId === 'string' ? props.parentId : null
  peer.createNodeWithId(nodeId, type, parentId, props as Partial<SceneNode>)
  if (parentId === null) peer.rootId = nodeId
}

function seedHostIntoYjs(host: SceneGraph): Y.Map<Y.Map<unknown>> {
  const doc = new Y.Doc()
  const ynodes = doc.getMap<Y.Map<unknown>>('nodes')
  doc.transact(() => {
    for (const node of host.getAllNodes()) {
      const ynode = new Y.Map<unknown>()
      ynodes.set(node.id, ynode)
      syncEncodedNodeToYMap(node, ynode)
    }
  })
  return ynodes
}

function firstPage(graph: SceneGraph): SceneNode {
  return expectDefined(graph.getPages()[0], 'first page')
}

type SyncedStores = ReturnType<typeof createSyncedStores>

type SyncedStoreOptions = {
  hostDoc?: Y.Doc
  peerDoc?: Y.Doc
  connectImmediately?: boolean
}

function createSyncedStores(options: SyncedStoreOptions = {}) {
  const hostStore = createEditorStore(new SceneGraph())
  const peerStore = createEditorStore(new SceneGraph())
  const hostDoc = options.hostDoc ?? new Y.Doc()
  const peerDoc = options.peerDoc ?? new Y.Doc()
  const hostNodes = hostDoc.getMap<Y.Map<unknown>>('nodes')
  const peerNodes = peerDoc.getMap<Y.Map<unknown>>('nodes')
  const hostImages = hostDoc.getMap<Uint8Array>('images')
  const peerImages = peerDoc.getMap<Uint8Array>('images')
  let hostSuppressYjsEvents = false
  let peerSuppressYjsEvents = false
  let hostSuppressGraphSync = false
  let peerSuppressGraphSync = false

  const hostSync = createYjsGraphSync({
    getStore: () => hostStore,
    getYdoc: () => hostDoc,
    getYnodes: () => hostNodes,
    getYimages: () => hostImages,
    setSuppressYjsEvents: (value) => {
      hostSuppressYjsEvents = value
    }
  })
  const peerSync = createYjsGraphSync({
    getStore: () => peerStore,
    getYdoc: () => peerDoc,
    getYnodes: () => peerNodes,
    getYimages: () => peerImages,
    setSuppressYjsEvents: (value) => {
      peerSuppressYjsEvents = value
    }
  })

  registerYjsObservers({
    store: hostStore,
    ynodes: hostNodes,
    yimages: hostImages,
    getSuppressYjsEvents: () => hostSuppressYjsEvents,
    setSuppressGraphSync: (value) => {
      hostSuppressGraphSync = value
    },
    applyYjsToGraph: hostSync.applyYjsToGraph
  })
  registerYjsObservers({
    store: peerStore,
    ynodes: peerNodes,
    yimages: peerImages,
    getSuppressYjsEvents: () => peerSuppressYjsEvents,
    setSuppressGraphSync: (value) => {
      peerSuppressGraphSync = value
    },
    applyYjsToGraph: peerSync.applyYjsToGraph
  })

  const disconnectYDocs =
    options.connectImmediately === false ? undefined : connectYDocs(hostDoc, peerDoc)

  return {
    hostStore,
    peerStore,
    hostSync,
    peerSync,
    hostDoc,
    peerDoc,
    disconnectYDocs,
    get hostSuppressGraphSync() {
      return hostSuppressGraphSync
    },
    get peerSuppressGraphSync() {
      return peerSuppressGraphSync
    },
    cleanup: () => {
      disconnectYDocs?.()
      hostDoc.destroy()
      peerDoc.destroy()
    }
  }
}

function withSyncedStores(run: (stores: SyncedStores) => void, options: SyncedStoreOptions = {}) {
  const stores = createSyncedStores(options)
  try {
    run(stores)
  } finally {
    stores.cleanup()
  }
}

describe('collab yjs-sync', () => {
  test('createNodeWithId forces the requested id even if synced props contain a stale id', () => {
    const graph = new SceneGraph()
    const page = firstPage(graph)
    const node = graph.createNodeWithId('remote-id', 'RECTANGLE', page.id, {
      id: 'stale-local-id',
      width: 50
    })

    expect(node.id).toBe('remote-id')
    expect(graph.getNode('remote-id')).toBe(node)
    expect(graph.getNode('stale-local-id')).toBeUndefined()
    expect(page.childIds).toContain('remote-id')
  })

  test('excludes derived text pictures from collaboration payloads', () => {
    const graph = new SceneGraph()
    const page = firstPage(graph)
    const text = graph.createNode('TEXT', page.id, {
      text: 'Shared text',
      textPicture: new Uint8Array([4, 5, 6])
    })
    const doc = new Y.Doc()
    const ynode = new Y.Map<unknown>()
    doc.getMap<Y.Map<unknown>>('nodes').set(text.id, ynode)

    syncEncodedNodeToYMap(text, ynode)

    expect(ynode.has('textPicture')).toBe(false)
    ynode.set('textPicture', new Uint8Array([9]))
    expect(decodeNodeFromYjs(ynode).textPicture).toBeNull()
  })

  test('normalizes malformed source metadata and geometry at the remote boundary', () => {
    const doc = new Y.Doc()
    const ynode = new Y.Map<unknown>()
    doc.getMap<Y.Map<unknown>>('nodes').set('remote', ynode)
    ynode.set('source', { format: 'fig', fig: { rawNodeFields: 'invalid' } })
    ynode.set('fillGeometry', [
      {
        windingRule: 'EVENODD',
        commandsBlob: new Uint8Array([0]),
        fills: [
          null,
          'invalid',
          {
            type: 'GRADIENT_LINEAR',
            color: { r: 0, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            gradientStops: 'invalid'
          },
          {
            type: 'NOISE',
            color: { r: 0, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            noiseSize: 'invalid'
          },
          {
            type: 'GRADIENT_LINEAR',
            color: { r: 0, g: 0, b: 0, a: 1 },
            opacity: 0.8,
            visible: true,
            gradientStops: [
              { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
              { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
            ],
            gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
          },
          {
            type: 'SOLID',
            color: { r: 1, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true
          }
        ]
      },
      { windingRule: 'NONZERO', commandsBlob: 'invalid' }
    ])
    ynode.set('strokeGeometry', 'invalid')

    const props = decodeNodeFromYjs(ynode)
    const source = props.source as SceneNode['source']
    const fillGeometry = props.fillGeometry as GeometryPath[]

    expect(source).toEqual({
      ...createDefaultSourceMetadata(),
      format: 'fig'
    })
    expect(fillGeometry).toHaveLength(1)
    expect(fillGeometry[0]?.commandsBlob).toBeInstanceOf(Uint8Array)
    expect(fillGeometry[0]?.fills).toHaveLength(2)
    expect(fillGeometry[0]?.fills?.[0]).toMatchObject({
      type: 'GRADIENT_LINEAR',
      opacity: 0.8,
      gradientStops: [
        { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
        { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
      ],
      gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    })
    expect(fillGeometry[0]?.fills?.[1]?.type).toBe('SOLID')
    expect(props.strokeGeometry).toEqual([])
  })

  test('binary geometry fields round-trip as Uint8Array, not strings', () => {
    const host = new SceneGraph()
    const page = firstPage(host)
    const blob = new Uint8Array([1, 2, 3, 250])
    const geometry: GeometryPath[] = [{ windingRule: 'NONZERO', commandsBlob: blob }]
    const ellipse = host.createNode('ELLIPSE', page.id, {
      width: 100,
      height: 100,
      fillGeometry: geometry
    })

    const doc = new Y.Doc()
    const ynode = new Y.Map<unknown>()
    doc.getMap<Y.Map<unknown>>('nodes').set(ellipse.id, ynode)
    syncEncodedNodeToYMap(ellipse, ynode)
    blob[0] = 99
    const props = decodeNodeFromYjs(ynode)

    expect(typeof ynode.get('fillGeometry')).not.toBe('string')
    const decoded = props.fillGeometry as GeometryPath[]
    expect(Array.isArray(decoded)).toBe(true)
    const commandsBlob = expectDefined(decoded[0], 'decoded geometry path').commandsBlob
    expect(commandsBlob).toBeInstanceOf(Uint8Array)
    expect(Array.from(commandsBlob)).toEqual([1, 2, 3, 250])
    expect(Array.isArray(props.strokeGeometry)).toBe(true)
  })

  test('a fresh peer reconstructs one ellipse, no duplicate childIds, order-independent', () => {
    const host = new SceneGraph()
    const hostPage = firstPage(host)
    const ellipse = host.createNode('ELLIPSE', hostPage.id, { width: 80, height: 60 })

    const ynodes = seedHostIntoYjs(host)

    const peer = new SceneGraph()
    const ids = [...ynodes.keys()].reverse()
    for (const id of ids) applyYnodeToGraph(peer, id, expectDefined(ynodes.get(id), `ynode ${id}`))

    const peerEllipse = getNodeOrThrow(peer, ellipse.id)
    expect(peerEllipse.type).toBe('ELLIPSE')
    expect(peerEllipse.parentId).toBe(hostPage.id)

    const peerPage = getNodeOrThrow(peer, hostPage.id)
    const refs = peerPage.childIds.filter((c) => c === ellipse.id)
    expect(refs).toHaveLength(1)
    expect(peer.getPages().map((page) => page.id)).toContain(hostPage.id)
  })

  test('a live-created node links into its parent even when the parent childIds was not re-synced', () => {
    const host = new SceneGraph()
    const hostPage = firstPage(host)
    const rect = host.createNode('RECTANGLE', hostPage.id, { width: 50, height: 50 })

    const doc = new Y.Doc()
    const ynodes = doc.getMap<Y.Map<unknown>>('nodes')
    doc.transact(() => {
      const pageYnode = new Y.Map<unknown>()
      ynodes.set(hostPage.id, pageYnode)
      syncEncodedNodeToYMap({ ...hostPage, childIds: [] } as SceneNode, pageYnode)

      const rectYnode = new Y.Map<unknown>()
      ynodes.set(rect.id, rectYnode)
      syncEncodedNodeToYMap(rect, rectYnode)
    })

    const peer = new SceneGraph()
    applyYnodeToGraph(peer, hostPage.id, expectDefined(ynodes.get(hostPage.id), 'page ynode'))
    applyYnodeToGraph(peer, rect.id, expectDefined(ynodes.get(rect.id), 'rect ynode'))

    const peerPage = getNodeOrThrow(peer, hostPage.id)
    expect(peerPage.childIds).toEqual([rect.id])
    expect(getNodeOrThrow(peer, rect.id).type).toBe('RECTANGLE')
  })

  test('syncAllNodesToYjs populates peer graph and current page', () => {
    withSyncedStores(({ hostStore, peerStore, hostSync }) => {
      const hostPage = firstPage(hostStore.graph)
      const rect = hostStore.graph.createNode('RECTANGLE', hostPage.id, { width: 80, height: 60 })

      hostSync.syncAllNodesToYjs()

      expect(peerStore.graph.rootId).toBe(hostStore.graph.rootId)
      expect(peerStore.state.currentPageId).toBe(hostPage.id)
      expect(peerStore.graph.getPages().map((page) => page.id)).toContain(hostPage.id)
      expect(getNodeOrThrow(peerStore.graph, rect.id).type).toBe('RECTANGLE')
    })
  })

  test('live-created and edited nodes sync in both directions', () => {
    withSyncedStores(({ hostStore, peerStore, hostSync, peerSync }) => {
      const hostPage = firstPage(hostStore.graph)
      hostSync.syncAllNodesToYjs()

      const rect = hostStore.graph.createNode('RECTANGLE', hostPage.id, { width: 50, height: 50 })
      hostSync.syncNodeToYjs(rect.id)

      const peerRect = getNodeOrThrow(peerStore.graph, rect.id)
      expect(peerRect.parentId).toBe(hostPage.id)
      expect(getNodeOrThrow(peerStore.graph, hostPage.id).childIds).toContain(rect.id)

      peerStore.graph.updateNode(rect.id, { x: 42, y: 24 })
      peerSync.syncNodeToYjs(rect.id)

      expect(getNodeOrThrow(hostStore.graph, rect.id).x).toBe(42)
      expect(getNodeOrThrow(hostStore.graph, rect.id).y).toBe(24)
    })
  })

  test('unchanged node synchronization emits no Yjs update', () => {
    withSyncedStores(({ hostStore, hostSync, hostDoc }) => {
      const hostPage = firstPage(hostStore.graph)
      const rect = hostStore.graph.createNode('RECTANGLE', hostPage.id, { width: 80, height: 60 })
      hostSync.syncNodeToYjs(rect.id)

      let updateCount = 0
      let updateBytes = 0
      const trackUpdate = (update: Uint8Array) => {
        updateCount++
        updateBytes += update.byteLength
      }
      hostDoc.on('update', trackUpdate)
      for (let index = 0; index < 100; index++) hostSync.syncNodeToYjs(rect.id)
      hostDoc.off('update', trackUpdate)

      expect(updateCount).toBe(0)
      expect(updateBytes).toBe(0)
    })
  })

  test('repeated drag-like updates stay field-sized and do not echo', () => {
    withSyncedStores(({ hostStore, peerStore, hostSync, hostDoc, peerDoc }) => {
      const hostPage = firstPage(hostStore.graph)
      const rect = hostStore.graph.createNode('RECTANGLE', hostPage.id, { width: 80, height: 60 })
      hostSync.syncAllNodesToYjs()
      hostSync.syncNodeToYjs(rect.id)

      let hostUpdateCount = 0
      let hostUpdateBytes = 0
      let peerUpdateCount = 0
      const trackHostUpdate = (update: Uint8Array) => {
        hostUpdateCount++
        hostUpdateBytes += update.byteLength
      }
      const trackPeerUpdate = () => {
        peerUpdateCount++
      }
      hostDoc.on('update', trackHostUpdate)
      peerDoc.on('update', trackPeerUpdate)

      for (let index = 1; index <= 100; index++) {
        hostStore.graph.updateNode(rect.id, { x: index })
        hostSync.syncNodeToYjs(rect.id)
      }

      hostDoc.off('update', trackHostUpdate)
      peerDoc.off('update', trackPeerUpdate)
      expect(getNodeOrThrow(peerStore.graph, rect.id).x).toBe(100)
      expect(hostUpdateCount).toBe(100)
      expect(peerUpdateCount).toBe(100)
      expect(hostUpdateBytes).toBeLessThan(8_000)
    })
  })

  test('queued concurrent edits converge through the official Yjs test connector', () => {
    const connector = new TestConnector(createPRNG(526))
    const hostDoc: TestYInstance = connector.createY(1)
    const peerDoc: TestYInstance = connector.createY(2)
    connector.syncAll()

    withSyncedStores(
      ({ hostStore, peerStore, hostSync, peerSync }) => {
        const hostPage = firstPage(hostStore.graph)
        const rect = hostStore.graph.createNode('RECTANGLE', hostPage.id, {
          width: 80,
          height: 60
        })
        hostSync.syncAllNodesToYjs()
        hostSync.syncNodeToYjs(rect.id)
        connector.flushAllMessages()
        expect(getNodeOrThrow(peerStore.graph, rect.id).type).toBe('RECTANGLE')

        hostDoc.disconnect()
        hostStore.graph.updateNode(rect.id, { x: 42 })
        hostSync.syncNodeToYjs(rect.id)
        peerStore.graph.updateNode(rect.id, { y: 24 })
        peerSync.syncNodeToYjs(rect.id)

        hostDoc.connect()
        expect(connector.flushRandomMessage()).toBe(true)
        connector.flushAllMessages()

        expect(getNodeOrThrow(hostStore.graph, rect.id)).toMatchObject({ x: 42, y: 24 })
        expect(getNodeOrThrow(peerStore.graph, rect.id)).toMatchObject({ x: 42, y: 24 })
        expect(Y.encodeStateVector(hostDoc)).toEqual(Y.encodeStateVector(peerDoc))
      },
      { hostDoc, peerDoc, connectImmediately: false }
    )
  })

  test('image fills sync image bytes', () => {
    withSyncedStores(({ hostStore, peerStore, hostSync }) => {
      const hostPage = firstPage(hostStore.graph)
      const imageHash = 'image-hash'
      const imageFill: Fill = {
        type: 'IMAGE',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        imageHash,
        imageScaleMode: 'FILL'
      }
      const rect = hostStore.graph.createNode('RECTANGLE', hostPage.id, { fills: [imageFill] })
      hostStore.graph.images.set(imageHash, new Uint8Array([9, 8, 7]))

      hostSync.syncNodeToYjs(rect.id)

      expect(
        Array.from(expectDefined(peerStore.graph.images.get(imageHash), 'peer image'))
      ).toEqual([9, 8, 7])
    })
  })

  test('synced node does not crash the visual-bounds helper', () => {
    const host = new SceneGraph()
    const hostPage = firstPage(host)
    const ellipse = host.createNode('ELLIPSE', hostPage.id, { width: 120, height: 90 })

    const ynodes = seedHostIntoYjs(host)
    const peer = new SceneGraph()
    for (const id of ynodes.keys()) {
      applyYnodeToGraph(peer, id, expectDefined(ynodes.get(id), `ynode ${id}`))
    }

    const peerEllipse = getNodeOrThrow(peer, ellipse.id)
    expect(() =>
      nodeVisualBounds(peerEllipse, (id) => {
        const n = peer.getNode(id)
        return { x: n?.x ?? 0, y: n?.y ?? 0 }
      })
    ).not.toThrow()
  })
})
