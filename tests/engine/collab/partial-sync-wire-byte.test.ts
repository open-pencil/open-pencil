import { describe, expect, test } from 'bun:test'
import * as Y from 'yjs'

import type { SceneNode } from '@inkly/core/scene-graph'

import { syncNodePropsToYMap } from '@/app/collab/yjs-sync'

type PartialSceneNode = Partial<SceneNode> & { id: string; type: string }

function makeNode(id: string): PartialSceneNode {
  return {
    id,
    type: 'RECT',
    name: 'Rectangle',
    parentId: 'PAGE',
    x: 100,
    y: 100,
    width: 200,
    height: 120,
    rotation: 0,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'NORMAL',
    fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.6, a: 1 } }],
    strokes: [],
    strokeWeight: 0,
    strokeAlign: 'CENTER',
    strokeDashes: [],
    effects: [],
    childIds: [],
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
    layoutMode: 'NONE',
    layoutDirection: 'HORIZONTAL',
    primaryAxisSizing: 'AUTO',
    counterAxisSizing: 'AUTO',
    counterAxisAlign: 'MIN',
    primaryAxisAlign: 'MIN',
    layoutWrap: 'NO_WRAP',
    itemSpacing: 0,
    counterAxisSpacing: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    layoutGrow: 0,
    layoutAlignSelf: 'AUTO',
    layoutPositioning: 'AUTO',
    minWidth: 0,
    maxWidth: Number.POSITIVE_INFINITY,
    minHeight: 0,
    maxHeight: Number.POSITIVE_INFINITY,
    cornerRadius: 0,
    cornerSmoothing: 0,
    source: {
      fig: { rawNodeFields: {}, rawSize: null, rawTransform: null },
      id: null,
      orderKey: 'a0',
      rawNodeFields: {}
    }
  } as PartialSceneNode
}

function asNode(node: PartialSceneNode): SceneNode {
  return node as PartialSceneNode as SceneNode
}

function measureUpdateSize(ydoc: Y.Doc, mutate: () => void): number {
  const before = Y.encodeStateAsUpdate(ydoc)
  mutate()
  const after = Y.encodeStateAsUpdate(ydoc)
  return Math.max(0, after.byteLength - before.byteLength)
}

describe('partial sync wire byte', () => {
  test('partial 更新 (1 key) と full 更新の wire byte (skip-equal 適用後)', () => {
    const fullDoc = new Y.Doc()
    const partialDoc = new Y.Doc()
    const fullNodes = fullDoc.getMap<Y.Map<unknown>>('nodes')
    const partialNodes = partialDoc.getMap<Y.Map<unknown>>('nodes')

    const node = makeNode('n1')
    fullDoc.transact(() => {
      const ynode = new Y.Map<unknown>()
      fullNodes.set(node.id, ynode)
      syncNodePropsToYMap(node, ynode)
    })
    partialDoc.transact(() => {
      const ynode = new Y.Map<unknown>()
      partialNodes.set(node.id, ynode)
      syncNodePropsToYMap(node, ynode)
    })

    const updatedNode = { ...node, x: 250 }

    const fullBytes = measureUpdateSize(fullDoc, () => {
      fullDoc.transact(() => {
        const ynode = fullNodes.get(node.id)
        if (!ynode) throw new Error('node missing')
        syncNodePropsToYMap(asNode(updatedNode), ynode)
      })
    })

    const partialBytes = measureUpdateSize(partialDoc, () => {
      partialDoc.transact(() => {
        const ynode = partialNodes.get(node.id)
        if (!ynode) throw new Error('node missing')
        syncNodePropsToYMap(asNode(updatedNode), ynode, ['x'])
      })
    })

    expect(partialBytes).toBeLessThan(50)
    expect(fullBytes).toBeLessThan(80)
  })

  test('partial 更新後 peer doc に partial 経路で正しく反映される', () => {
    const hostDoc = new Y.Doc()
    const peerDoc = new Y.Doc()
    const hostNodes = hostDoc.getMap<Y.Map<unknown>>('nodes')
    const peerNodes = peerDoc.getMap<Y.Map<unknown>>('nodes')

    const node = makeNode('n1')
    hostDoc.transact(() => {
      const ynode = new Y.Map<unknown>()
      hostNodes.set(node.id, ynode)
      syncNodePropsToYMap(node, ynode)
    })

    let update = Y.encodeStateAsUpdate(hostDoc)
    Y.applyUpdate(peerDoc, update)
    expect(peerNodes.get(node.id)?.get('x')).toBe(100)

    const updatedNode = { ...node, x: 350, y: 220 }
    const lastState = Y.encodeStateVector(peerDoc)

    hostDoc.transact(() => {
      const ynode = hostNodes.get(node.id)
      if (!ynode) throw new Error('node missing')
      syncNodePropsToYMap(asNode(updatedNode), ynode, ['x', 'y'])
    })

    update = Y.encodeStateAsUpdate(hostDoc, lastState)
    Y.applyUpdate(peerDoc, update)

    const peerYnode = peerNodes.get(node.id)
    expect(peerYnode?.get('x')).toBe(350)
    expect(peerYnode?.get('y')).toBe(220)
    expect(peerYnode?.get('width')).toBe(200)
    expect(peerYnode?.get('rotation')).toBe(0)
  })

  test('値が変わらない再 sync は wire byte 0 (skip-equal)', () => {
    const hostDoc = new Y.Doc()
    const hostNodes = hostDoc.getMap<Y.Map<unknown>>('nodes')

    const node = makeNode('n1')
    hostDoc.transact(() => {
      const ynode = new Y.Map<unknown>()
      hostNodes.set(node.id, ynode)
      syncNodePropsToYMap(node, ynode)
    })

    const bytes = measureUpdateSize(hostDoc, () => {
      hostDoc.transact(() => {
        const ynode = hostNodes.get(node.id)
        if (!ynode) throw new Error('node missing')
        syncNodePropsToYMap(node, ynode, ['x', 'y', 'width', 'fills'])
      })
    })

    expect(bytes).toBe(0)
  })

  test('10 node に対し 1 key partial 更新を 50 回流すと wire byte 累計が削減される', () => {
    const fullDoc = new Y.Doc()
    const partialDoc = new Y.Doc()
    const fullNodes = fullDoc.getMap<Y.Map<unknown>>('nodes')
    const partialNodes = partialDoc.getMap<Y.Map<unknown>>('nodes')

    const nodes = Array.from({ length: 10 }, (_, i) => makeNode(`n${i}`))
    for (const n of nodes) {
      fullDoc.transact(() => {
        const ynode = new Y.Map<unknown>()
        fullNodes.set(n.id, ynode)
        syncNodePropsToYMap(n, ynode)
      })
      partialDoc.transact(() => {
        const ynode = new Y.Map<unknown>()
        partialNodes.set(n.id, ynode)
        syncNodePropsToYMap(n, ynode)
      })
    }

    let fullTotal = 0
    let partialTotal = 0
    for (let step = 1; step <= 50; step++) {
      for (const n of nodes) {
        const next = { ...n, x: n.x + step }
        fullTotal += measureUpdateSize(fullDoc, () => {
          fullDoc.transact(() => {
            const ynode = fullNodes.get(n.id)
            if (!ynode) return
            syncNodePropsToYMap(asNode(next), ynode)
          })
        })
        partialTotal += measureUpdateSize(partialDoc, () => {
          partialDoc.transact(() => {
            const ynode = partialNodes.get(n.id)
            if (!ynode) return
            syncNodePropsToYMap(asNode(next), ynode, ['x'])
          })
        })
      }
    }

    expect(partialTotal).toBeLessThanOrEqual(fullTotal)
    expect(partialTotal).toBeLessThan(10_000)
  })
})
