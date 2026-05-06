import { describe, expect, it } from 'bun:test'

import { importClipboardNodes } from '@open-pencil/core'
import type { NodeChange, SceneNode } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { createClipboardGraph } from '#tests/helpers/clipboard'

describe('importClipboardNodes: undo redo', () => {
  it('undo removes all imported nodes including children', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'FRAME',
        name: 'Parent',
        size: { x: 400, y: 300 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '!' },
        type: 'RECTANGLE',
        name: 'Child1',
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '"' },
        type: 'TEXT',
        name: 'Child2',
        size: { x: 200, y: 30 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 100 },
        textData: { characters: 'Hello' },
        fontSize: 14
      }
    ] as NodeChange[]

    const nodesBefore = [...graph.getAllNodes()].length
    const childrenBefore = graph.getChildren(pageId).length
    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect([...graph.getAllNodes()].length).toBe(nodesBefore + 3)

    for (const id of [...created].reverse()) graph.deleteNode(id)
    expect([...graph.getAllNodes()].length).toBe(nodesBefore)
    expect(graph.getChildren(pageId)).toHaveLength(childrenBefore)
  })

  it('redo recreates full subtree with correct parent-child relationships', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'FRAME',
        name: 'Parent',
        size: { x: 400, y: 300 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '!' },
        type: 'RECTANGLE',
        name: 'Child1',
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '"' },
        type: 'TEXT',
        name: 'Child2',
        size: { x: 200, y: 30 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 100 },
        textData: { characters: 'Hello' },
        fontSize: 14
      }
    ] as NodeChange[]

    const childrenBefore = graph.getChildren(pageId).length
    const created = importClipboardNodes(nodeChanges, graph, pageId)
    const parent = getNodeOrThrow(graph, created[0])

    const allSnapshots: SceneNode[] = []
    function walk(id: string) {
      const n = getNodeOrThrow(graph, id)
      allSnapshots.push({ ...n })
      for (const cid of n.childIds) walk(cid)
    }
    for (const id of created) walk(id)

    // Undo
    for (const id of [...created].reverse()) graph.deleteNode(id)
    expect(graph.getChildren(pageId)).toHaveLength(childrenBefore)

    // Redo — recreate with childIds: [] to avoid duplicates from createNode's parent-append
    for (const snapshot of allSnapshots) {
      graph.createNode(snapshot.type, snapshot.parentId ?? pageId, {
        ...snapshot,
        childIds: []
      })
    }

    const restored = getNodeOrThrow(graph, parent.id)
    expect(restored).toBeTruthy()
    expect(restored.name).toBe('Parent')
    expect(restored.childIds).toHaveLength(2)

    const children = graph.getChildren(restored.id)
    expect(children[0].name).toBe('Child1')
    expect(children[1].name).toBe('Child2')
    expect(children[1].text).toBe('Hello')
  })

  it('redo without childIds:[] causes duplicate children', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'FRAME',
        name: 'Parent',
        size: { x: 400, y: 300 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '!' },
        type: 'RECTANGLE',
        name: 'Child',
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    const parent = getNodeOrThrow(graph, created[0])

    const allSnapshots: SceneNode[] = []
    function walk(id: string) {
      const n = getNodeOrThrow(graph, id)
      allSnapshots.push({ ...n })
      for (const cid of n.childIds) walk(cid)
    }
    for (const id of created) walk(id)

    for (const id of [...created].reverse()) graph.deleteNode(id)

    // Recreate WITHOUT clearing childIds — demonstrates the bug
    for (const snapshot of allSnapshots) {
      graph.createNode(snapshot.type, snapshot.parentId ?? pageId, snapshot)
    }

    const restored = getNodeOrThrow(graph, parent.id)
    // Bug: parent has duplicated childIds because snapshot already had [childId]
    // and createNode appends childId again
    expect(restored.childIds.length).toBeGreaterThan(1)
  })
})
