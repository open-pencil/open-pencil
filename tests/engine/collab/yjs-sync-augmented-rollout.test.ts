import { describe, expect, test } from 'bun:test'
import * as Y from 'yjs'

import { SceneGraph, type FigmaDerivedTextGlyph, type SceneNode } from '#core/scene-graph'

import { bindCollabGraphEvents, syncNodePropsToYMap } from '@/app/collab/yjs-sync'

function getYNode(ynodes: Y.Map<Y.Map<unknown>>, nodeId: string): Y.Map<unknown> {
  const ynode = ynodes.get(nodeId)
  if (!ynode) throw new Error(`Missing Y.Map for node ${nodeId}`)
  return ynode
}

function createYFixture(node: SceneNode) {
  const ydoc = new Y.Doc()
  const ynodes = ydoc.getMap('nodes') as Y.Map<Y.Map<unknown>>
  const ynode = new Y.Map<unknown>()
  ynodes.set(node.id, ynode)
  syncNodePropsToYMap(node, ynode)
  return { ydoc, ynodes, ynode }
}

describe('yjs sync augmented rollout', () => {
  test('TC YS1 partial TEXT sync rolls textPicture and figmaDerivedTextGlyphs to null', () => {
    // Given
    const graph = new SceneGraph()
    const page = graph.addPage('P')
    const text = graph.createNode('TEXT', page.id, { name: 'TXT', text: 'A' })
    const glyphs: FigmaDerivedTextGlyph[] = [
      { commandsBlob: new Uint8Array([1]), x: 0, y: 0, fontSize: 12 }
    ]
    text.textPicture = new Uint8Array([0, 1, 2])
    text.figmaDerivedTextGlyphs = glyphs
    const { ynodes, ynode } = createYFixture(text)

    graph.onNodeEvents({ updated: (id, changes) => {
      const nextYNode = getYNode(ynodes, id)
      syncNodePropsToYMap(text, nextYNode, Object.keys(changes))
    } })

    // When
    graph.updateNode(text.id, { text: 'B' })

    // Then
    expect(ynode.get('textPicture')).toBeNull()
    expect(ynode.get('figmaDerivedTextGlyphs')).toBeNull()
  })

  test('TC YS2 bindCollabGraphEvents forwards changed keys for partial sibling-safe patches', () => {
    // Given
    const graph = new SceneGraph()
    const page = graph.addPage('P')
    const frame = graph.createNode('FRAME', page.id, { width: 100, height: 50 })
    const { ydoc, ynodes, ynode } = createYFixture(frame)
    ynode.set('width', 999)

    const storeLike: Pick<
      Parameters<typeof bindCollabGraphEvents>[0]['store'],
      'graph' | 'onEditorEvent'
    > = {
      graph,
      onEditorEvent(event: string, handler: (...args: unknown[]) => void) {
        if (event === 'node:updated') {
          return graph.onNodeEvents({
            updated: handler as (id: string, changes: Partial<SceneNode>) => void
          })
        }
        if (event === 'node:created') {
          return graph.onNodeEvents({ created: handler as (node: SceneNode) => void })
        }
        if (event === 'node:reparented') {
          return graph.onNodeEvents({
            reparented: handler as (nodeId: string, oldParentId: string, newParentId: string) => void
          })
        }
        if (event === 'node:reordered') {
          return graph.onNodeEvents({
            reordered: handler as (nodeId: string, parentId: string, index: number) => void
          })
        }
        if (event === 'node:deleted') {
          return graph.onNodeEvents({ deleted: handler as (id: string) => void })
        }
        return () => undefined
      }
    }
    const store = storeLike as Parameters<typeof bindCollabGraphEvents>[0]['store']

    const unbind = bindCollabGraphEvents({
      store,
      getYdoc: () => ydoc,
      getYnodes: () => ynodes,
      getSuppressGraphSync: () => false,
      setSuppressYjsEvents: () => undefined,
      syncNodeToYjs: (nodeId, changedKeys) => {
        const node = graph.getNode(nodeId)
        if (!node || changedKeys === undefined) return
        const nextYNode = getYNode(ynodes, nodeId)
        syncNodePropsToYMap(node, nextYNode, Array.from(changedKeys))
      }
    })

    // When
    graph.updateNode(frame.id, { x: 50 })

    // Then
    expect(ynode.get('x')).toBe(50)
    expect(ynode.get('width')).toBe(999)

    unbind()
  })

  test('TC YS3 import-source rollout syncs source on partial fills patch', () => {
    // Given
    const graph = new SceneGraph()
    const page = graph.addPage('P')
    const frame = graph.createNode('FRAME', page.id, { width: 100, height: 50 })
    frame.source.fig.rawNodeFields = { foo: 'bar' }
    const { ynodes, ynode } = createYFixture(frame)

    graph.onNodeEvents({ updated: (id, changes) => {
      const nextYNode = getYNode(ynodes, id)
      const node = graph.getNode(id)
      if (!node) throw new Error(`Missing node ${id}`)
      syncNodePropsToYMap(node, nextYNode, Object.keys(changes))
    } })

    // When
    graph.updateNode(frame.id, {
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    // Then
    const syncedSource = JSON.parse(ynode.get('source') as string) as SceneNode['source']
    expect(syncedSource.fig.rawNodeFields).toEqual({})
  })

  test('TC YS4 TEXT update syncs textPicture and source together on partial patch', () => {
    // Given
    const graph = new SceneGraph()
    const page = graph.addPage('P')
    const text = graph.createNode('TEXT', page.id, { name: 'TXT', text: 'A' })
    const glyphs: FigmaDerivedTextGlyph[] = [
      { commandsBlob: new Uint8Array([1]), x: 0, y: 0, fontSize: 12 }
    ]
    text.textPicture = new Uint8Array([0, 1, 2])
    text.figmaDerivedTextGlyphs = glyphs
    text.source.fig.rawNodeFields = { x: 1 }
    const { ynodes, ynode } = createYFixture(text)

    graph.onNodeEvents({ updated: (id, changes) => {
      const nextYNode = getYNode(ynodes, id)
      const node = graph.getNode(id)
      if (!node) throw new Error(`Missing node ${id}`)
      syncNodePropsToYMap(node, nextYNode, Object.keys(changes))
    } })

    // When
    graph.updateNode(text.id, { text: 'New' })

    // Then
    expect(ynode.get('textPicture')).toBeNull()
    expect(ynode.get('figmaDerivedTextGlyphs')).toBeNull()
    const syncedSource = JSON.parse(ynode.get('source') as string) as SceneNode['source']
    expect(syncedSource.fig.rawNodeFields).toEqual({})
  })
})
