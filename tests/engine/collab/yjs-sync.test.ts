import { describe, test, expect } from 'bun:test'

import * as Y from 'yjs'

import type { GeometryPath, SceneNode } from '@open-pencil/core'

import { syncNodePropsToYMap, yNodeToProps } from '@/app/collab/yjs-sync'

import { nodeVisualBounds } from '#core/geometry'
import { SceneGraph } from '#core/scene-graph'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'

// Mirrors src/app/collab/yjs-sync.ts applyYnodeToGraph: decode the synced props,
// then update in place if the node already exists or reconstruct it under its own
// id. Kept in lockstep with the real apply so the test exercises the same path.
function applyYnodeToGraph(peer: SceneGraph, nodeId: string, ynode: Y.Map<unknown>) {
  const props = yNodeToProps(ynode)
  if (peer.getNode(nodeId)) {
    peer.updateNode(nodeId, props as Partial<SceneNode>)
    return
  }
  const type = props.type as SceneNode['type'] | undefined
  if (!type) return
  const parentId = typeof props.parentId === 'string' ? props.parentId : ''
  peer.createNodeWithId(nodeId, type, parentId, props as Partial<SceneNode>)
}

// Seed every host node into a Yjs nodes map, exactly like syncAllNodesToYjs.
function seedHostIntoYjs(host: SceneGraph): Y.Map<Y.Map<unknown>> {
  const doc = new Y.Doc()
  const ynodes = doc.getMap<Y.Map<unknown>>('nodes')
  doc.transact(() => {
    for (const node of host.getAllNodes()) {
      const ynode = new Y.Map<unknown>()
      ynodes.set(node.id, ynode)
      syncNodePropsToYMap(node, ynode)
    }
  })
  return ynodes
}

function firstPage(graph: SceneGraph): SceneNode {
  return expectDefined(graph.getPages()[0], 'first page')
}

describe('collab yjs-sync', () => {
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
    syncNodePropsToYMap(ellipse, ynode)
    const props = yNodeToProps(ynode)

    const decoded = props.fillGeometry as GeometryPath[]
    expect(Array.isArray(decoded)).toBe(true)
    const commandsBlob = expectDefined(decoded[0], 'decoded geometry path').commandsBlob
    expect(commandsBlob).toBeInstanceOf(Uint8Array)
    expect(Array.from(commandsBlob)).toEqual([1, 2, 3, 250])
    // strokeGeometry defaults to [] — must decode to an array, never the string "[]".
    expect(Array.isArray(props.strokeGeometry)).toBe(true)
  })

  test('a fresh peer reconstructs one ellipse, no duplicate childIds, order-independent', () => {
    const host = new SceneGraph()
    const hostPage = firstPage(host)
    const ellipse = host.createNode('ELLIPSE', hostPage.id, { width: 80, height: 60 })

    const ynodes = seedHostIntoYjs(host)

    // Apply in REVERSE document order (ellipse before its page/root) to prove the
    // apply no longer depends on parents arriving first.
    const peer = new SceneGraph()
    const ids = [...ynodes.keys()].reverse()
    for (const id of ids) applyYnodeToGraph(peer, id, expectDefined(ynodes.get(id), `ynode ${id}`))

    const peerEllipse = getNodeOrThrow(peer, ellipse.id)
    expect(peerEllipse.type).toBe('ELLIPSE')
    expect(peerEllipse.parentId).toBe(hostPage.id)

    const peerPage = getNodeOrThrow(peer, hostPage.id)
    const refs = peerPage.childIds.filter((c) => c === ellipse.id)
    expect(refs).toHaveLength(1) // exactly one reference — no duplicate-layer corruption
  })

  test('a live-created node links into its parent even when the parent childIds was not re-synced', () => {
    const host = new SceneGraph()
    const hostPage = firstPage(host)
    const rect = host.createNode('RECTANGLE', hostPage.id, { width: 50, height: 50 })

    // Drawing a shape after sharing only syncs the new node — createNode never
    // re-syncs the parent — so the parent arrives WITHOUT the child in its childIds.
    const doc = new Y.Doc()
    const ynodes = doc.getMap<Y.Map<unknown>>('nodes')
    doc.transact(() => {
      const pageYnode = new Y.Map<unknown>()
      ynodes.set(hostPage.id, pageYnode)
      syncNodePropsToYMap({ ...hostPage, childIds: [] } as SceneNode, pageYnode)

      const rectYnode = new Y.Map<unknown>()
      ynodes.set(rect.id, rectYnode)
      syncNodePropsToYMap(rect, rectYnode)
    })

    const peer = new SceneGraph()
    applyYnodeToGraph(peer, hostPage.id, expectDefined(ynodes.get(hostPage.id), 'page ynode'))
    applyYnodeToGraph(peer, rect.id, expectDefined(ynodes.get(rect.id), 'rect ynode'))

    const peerPage = getNodeOrThrow(peer, hostPage.id)
    expect(peerPage.childIds).toEqual([rect.id]) // linked exactly once
    expect(getNodeOrThrow(peer, rect.id).type).toBe('RECTANGLE')
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
    // Pre-fix this threw `Cannot read properties of undefined (reading 'buffer')`
    // because fillGeometry arrived as the string "[]".
    expect(() =>
      nodeVisualBounds(peerEllipse, (id) => {
        const n = peer.getNode(id)
        return { x: n?.x ?? 0, y: n?.y ?? 0 }
      })
    ).not.toThrow()
  })
})
