import { describe, expect, test } from 'bun:test'

import * as Y from 'yjs'

import type { Vector } from '@open-pencil/core'
import { SceneGraph, type SceneNode } from '@open-pencil/core/scene-graph'

import { COLLAB_NODE_FIELDS, decodeNodeFromYjs, encodeNodeForYjs } from '@/app/collab/node-codec'
import {
  bindCollabGraphEvents,
  createYjsGraphSync,
  registerYjsObservers,
  syncNodePropsToYMap
} from '@/app/collab/yjs-sync'
import type { EditorStore } from '@/app/editor/active-store'

import { getFillGeometry } from '#core/canvas/shapes'
import { computeDescendantVisualBounds } from '#core/geometry'

type SceneNodeWithOptionalSource = Omit<SceneNode, 'source'> & { source?: SceneNode['source'] }

function malformedGeometryPath(): SceneNode['fillGeometry'][number] {
  return { windingRule: 'NONZERO' } as SceneNode['fillGeometry'][number]
}

function commandsBlobFromPoints(points: Vector[]): Uint8Array {
  const blob = new Uint8Array(points.length * 9 + 1)
  const view = new DataView(blob.buffer)
  let offset = 0
  for (const point of points) {
    blob[offset] = 1
    view.setFloat32(offset + 1, point.x, true)
    view.setFloat32(offset + 5, point.y, true)
    offset += 9
  }
  blob[offset] = 0
  return blob
}

function createGraphWithPage() {
  const graph = new SceneGraph()
  const page = graph.createNode('CANVAS', graph.rootId, { name: 'Page' })
  return { graph, page }
}

function createYNode() {
  return new Y.Doc().getMap<unknown>('node')
}

function createPathRenderer() {
  class MockPath {
    calls = 0
    close() {
      this.calls += 1
    }
    moveTo() {
      this.calls += 1
    }
    lineTo() {
      this.calls += 1
    }
    quadTo() {
      this.calls += 1
    }
    cubicTo() {
      this.calls += 1
    }
    setFillType() {
      this.calls += 1
    }
  }

  return {
    ck: {
      Path: MockPath,
      FillType: { EvenOdd: 'EvenOdd', Winding: 'Winding' }
    },
    fillGeometryCache: new Map(),
    strokeGeometryCache: new Map()
  }
}

describe('collab Yjs node codec', () => {
  test('round-trips source metadata and geometry command blobs', () => {
    const { graph, page } = createGraphWithPage()
    const commandsBlob = commandsBlobFromPoints([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ])
    const node = graph.createNode('RECTANGLE', page.id, {
      name: 'Remote rectangle',
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      fillGeometry: [{ windingRule: 'NONZERO', commandsBlob }],
      source: {
        format: 'fig',
        id: 'fig-node',
        orderKey: 'a1',
        fig: {
          rawSize: { x: 10, y: 10 },
          rawTransform: null,
          rawNodeFields: { fillGeometry: [{ commandsBlob: 0 }] },
          layout: null,
          symbolOverrides: [],
          componentPropAssignments: [],
          derivedSymbolData: [],
          derivedSymbolDataLayoutVersion: null,
          uniformScaleFactor: null
        }
      }
    })

    const ynode = createYNode()
    syncNodePropsToYMap(node, ynode)
    const props = decodeNodeFromYjs(ynode)

    expect(props.source).toMatchObject({ format: 'fig', id: 'fig-node', orderKey: 'a1' })
    const fillGeometry = props.fillGeometry as SceneNode['fillGeometry']
    expect(fillGeometry[0]?.commandsBlob).toBeInstanceOf(Uint8Array)
    expect([...fillGeometry[0].commandsBlob]).toEqual([...commandsBlob])
  })

  test('encodes only approved graph fields plus a null text picture cache', () => {
    const { graph, page } = createGraphWithPage()
    const node = graph.createNode('RECTANGLE', page.id, { width: 10, height: 10 })

    const keys = Object.keys(encodeNodeForYjs(node)).sort()

    expect(keys).toEqual([...COLLAB_NODE_FIELDS, 'textPicture'].sort())
  })

  test('normalizes omitted source metadata during decode', () => {
    const ynode = createYNode()
    ynode.set('id', 'remote')
    ynode.set('type', 'RECTANGLE')

    const props = decodeNodeFromYjs(ynode)

    expect(props.source?.fig.rawNodeFields).toEqual({})
  })

  test('decodes legacy stringified object fields', () => {
    const ynode = createYNode()
    ynode.set('id', 'remote')
    ynode.set('type', 'RECTANGLE')
    ynode.set('childIds', JSON.stringify(['child']))
    ynode.set(
      'fills',
      JSON.stringify([
        { type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 1, visible: true }
      ])
    )
    ynode.set(
      'source',
      JSON.stringify({
        format: null,
        id: null,
        orderKey: null,
        fig: { rawNodeFields: { opacity: 1 } }
      })
    )

    const props = decodeNodeFromYjs(ynode)

    expect(props.childIds).toEqual(['child'])
    expect(props.fills).toMatchObject([{ type: 'SOLID' }])
    expect(props.source).toMatchObject({ fig: { rawNodeFields: { opacity: 1 } } })
  })

  test('decodes legacy stringified Uint8Array geometry records', () => {
    const commandsBlob = new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    const ynode = createYNode()
    ynode.set('fillGeometry', JSON.stringify([{ windingRule: 'EVENODD', commandsBlob }]))

    const props = decodeNodeFromYjs(ynode)
    const fillGeometry = props.fillGeometry as SceneNode['fillGeometry']

    expect(fillGeometry[0]?.windingRule).toBe('EVENODD')
    expect(fillGeometry[0]?.commandsBlob).toBeInstanceOf(Uint8Array)
    expect([...fillGeometry[0].commandsBlob]).toEqual([...commandsBlob])
  })

  test('normalizes missing source metadata before graph updates clear raw metadata', () => {
    const { graph, page } = createGraphWithPage()
    const node = graph.createNode('RECTANGLE', page.id, { width: 10, height: 10 })
    const corruptNode = node as SceneNodeWithOptionalSource
    corruptNode.source = undefined

    expect(() => graph.updateNode(node.id, { width: 20 })).not.toThrow()
    expect(node.source.fig.rawSize).toBeNull()
    expect(node.width).toBe(20)
  })

  test('skips malformed geometry while preserving valid sibling geometry', () => {
    const { graph, page } = createGraphWithPage()
    const validBlob = commandsBlobFromPoints([
      { x: 0, y: 0 },
      { x: 5, y: 5 }
    ])
    const node = graph.createNode('RECTANGLE', page.id, {
      width: 10,
      height: 10,
      fillGeometry: [
        { windingRule: 'NONZERO', commandsBlob: validBlob },
        { windingRule: 'NONZERO', commandsBlob: new Uint8Array([4, 0]) },
        malformedGeometryPath()
      ]
    })

    expect(() =>
      computeDescendantVisualBounds(
        [node.id],
        (id) => graph.getNode(id),
        (id) => graph.getAbsolutePosition(id)
      )
    ).not.toThrow()
    expect(() => getFillGeometry(createPathRenderer() as never, node)).not.toThrow()
    expect(getFillGeometry(createPathRenderer() as never, node)).toHaveLength(1)
  })

  test('round-trips vector networks and image fill references without embedding image bytes in node props', () => {
    const { graph, page } = createGraphWithPage()
    const node = graph.createNode('RECTANGLE', page.id, {
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0, strokeCap: 'NONE', strokeJoin: 'MITER', cornerRadius: 0 },
          { x: 10, y: 0, strokeCap: 'NONE', strokeJoin: 'MITER', cornerRadius: 0 }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      },
      fills: [
        {
          type: 'IMAGE',
          color: { r: 1, g: 1, b: 1, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: 'hash-1',
          scaleMode: 'FILL'
        }
      ]
    })
    graph.images.set('hash-1', new Uint8Array([1, 2, 3]))

    const ynode = createYNode()
    syncNodePropsToYMap(node, ynode)
    const props = decodeNodeFromYjs(ynode)

    expect(props.fills).toMatchObject([{ imageHash: 'hash-1' }])
    expect(props.vectorNetwork?.vertices[0]).toMatchObject({ x: 0, y: 0 })
    expect(props.vectorNetwork?.segments[0]).toMatchObject({ start: 0, end: 1 })
    expect(JSON.stringify(ynode.toJSON())).not.toContain('1,2,3')
  })

  test('resolves image bytes that arrive after image node references', () => {
    const local = createGraphWithPage()
    const remote = createGraphWithPage()
    const remoteNode = remote.graph.createNode('RECTANGLE', local.page.id, {
      id: 'image-node',
      fills: [
        {
          type: 'IMAGE',
          color: { r: 1, g: 1, b: 1, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: 'late-image',
          scaleMode: 'FILL'
        }
      ]
    })
    const ydoc = new Y.Doc()
    const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes')
    const yimages = ydoc.getMap<Uint8Array>('images')
    const store = {
      graph: local.graph,
      requestRender: () => undefined
    } as Pick<EditorStore, 'graph' | 'requestRender'>
    const { applyYjsToGraph } = createYjsGraphSync({
      getStore: () => store as EditorStore,
      getYdoc: () => ydoc,
      getYnodes: () => ynodes,
      getYimages: () => yimages,
      setSuppressYjsEvents: () => undefined
    })
    registerYjsObservers({
      store: store as EditorStore,
      ynodes,
      yimages,
      getSuppressYjsEvents: () => false,
      setSuppressGraphSync: () => undefined,
      applyYjsToGraph
    })

    const ynode = new Y.Map<unknown>()
    syncNodePropsToYMap(remoteNode, ynode)
    ynodes.set(remoteNode.id, ynode)
    expect(local.graph.getNode(remoteNode.id)?.fills).toMatchObject([{ imageHash: 'late-image' }])
    expect(local.graph.images.has('late-image')).toBe(false)

    yimages.set('late-image', new Uint8Array([8, 9, 10]))

    expect([...(local.graph.images.get('late-image') ?? [])]).toEqual([8, 9, 10])
  })

  test('applies remote create with original id, parent, placement, and child ordering', () => {
    const local = createGraphWithPage()
    const remote = createGraphWithPage()
    const remoteNodeId = 'remote-rect'
    const sibling = local.graph.createNode('RECTANGLE', local.page.id, { id: 'sibling' })
    local.page.childIds = [remoteNodeId, sibling.id]
    const remoteNode = remote.graph.createNode('RECTANGLE', local.page.id, {
      id: remoteNodeId,
      name: 'Remote rectangle',
      x: 42,
      y: 24,
      width: 10,
      height: 20
    })

    const ydoc = new Y.Doc()
    const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes')
    const yimages = ydoc.getMap<Uint8Array>('images')
    const store = {
      graph: local.graph,
      requestRender: () => undefined
    } as Pick<EditorStore, 'graph' | 'requestRender'>
    const { applyYjsToGraph } = createYjsGraphSync({
      getStore: () => store as EditorStore,
      getYdoc: () => ydoc,
      getYnodes: () => ynodes,
      getYimages: () => null,
      setSuppressYjsEvents: () => undefined
    })
    registerYjsObservers({
      store: store as EditorStore,
      ynodes,
      yimages,
      getSuppressYjsEvents: () => false,
      setSuppressGraphSync: () => undefined,
      applyYjsToGraph
    })

    const parentYnode = new Y.Map<unknown>()
    syncNodePropsToYMap(local.page, parentYnode)
    ynodes.set(local.page.id, parentYnode)

    const ynode = new Y.Map<unknown>()
    syncNodePropsToYMap(remoteNode, ynode)
    ynodes.set(remoteNode.id, ynode)

    const created = local.graph.getNode(remoteNode.id)
    expect(created?.id).toBe(remoteNode.id)
    expect(created?.parentId).toBe(local.page.id)
    expect(created).toMatchObject({ x: 42, y: 24, width: 10, height: 20 })
    expect(local.graph.getNode(local.page.id)?.childIds).toEqual([remoteNode.id, sibling.id])
  })

  test('syncs parent nodes when child order changes', () => {
    const handlers: Record<string, Array<(...args: unknown[]) => void>> = {}
    const store = {
      onEditorEvent(event: string, handler: (...args: unknown[]) => void) {
        handlers[event] = [...(handlers[event] ?? []), handler]
        return () => undefined
      }
    } as Pick<EditorStore, 'onEditorEvent'>
    const ydoc = new Y.Doc()
    const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes')
    const synced: string[] = []

    bindCollabGraphEvents({
      store,
      getYdoc: () => ydoc,
      getYnodes: () => ynodes,
      getSuppressGraphSync: () => false,
      setSuppressYjsEvents: () => undefined,
      syncNodeToYjs: (nodeId) => synced.push(nodeId)
    })

    handlers['node:created']?.[0]?.({ id: 'new-child', parentId: 'parent' })
    handlers['node:reordered']?.[0]?.('child', 'parent', 0)
    handlers['node:reparented']?.[0]?.('child', 'old-parent', 'new-parent')

    expect(synced).toEqual([
      'new-child',
      'parent',
      'child',
      'parent',
      'child',
      'old-parent',
      'new-parent'
    ])
  })

  test('preserves graph sync suppression for remote updates and resumes local sync afterward', () => {
    const handlers: Record<string, Array<(...args: unknown[]) => void>> = {}
    const store = {
      onEditorEvent(event: string, handler: (...args: unknown[]) => void) {
        handlers[event] = [...(handlers[event] ?? []), handler]
        return () => undefined
      }
    } as Pick<EditorStore, 'onEditorEvent'>
    const ydoc = new Y.Doc()
    const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes')
    let suppressGraphSync = true
    let syncCount = 0

    bindCollabGraphEvents({
      store,
      getYdoc: () => ydoc,
      getYnodes: () => ynodes,
      getSuppressGraphSync: () => suppressGraphSync,
      setSuppressYjsEvents: () => undefined,
      syncNodeToYjs: () => {
        syncCount += 1
      }
    })

    handlers['node:updated']?.[0]?.('remote-id', {})
    suppressGraphSync = false
    handlers['node:updated']?.[0]?.('local-id', {})

    expect(syncCount).toBe(1)
  })
})
