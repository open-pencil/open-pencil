import { describe, expect, it } from 'bun:test'

import { importClipboardNodes } from '@open-pencil/core'
import type { NodeChange } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { createClipboardGraph } from '#tests/helpers/clipboard'

describe('importClipboardNodes: hierarchy', () => {
  it('imports nested frames with children', () => {
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
        name: 'Outer',
        size: { x: 400, y: 300 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '!' },
        type: 'FRAME',
        name: 'Inner',
        size: { x: 200, y: 100 },
        transform: { m00: 1, m01: 0, m02: 20, m10: 0, m11: 1, m12: 20 }
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 11 }, position: '!' },
        type: 'TEXT',
        name: 'Label',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 5, m10: 0, m11: 1, m12: 5 },
        textData: { characters: 'Test' },
        fontSize: 14
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(created).toHaveLength(1)

    const outer = getNodeOrThrow(graph, created[0])
    expect(outer.name).toBe('Outer')

    const innerList = graph.getChildren(outer.id)
    expect(innerList).toHaveLength(1)
    expect(innerList[0].name).toBe('Inner')

    const labels = graph.getChildren(innerList[0].id)
    expect(labels).toHaveLength(1)
    expect(labels[0].name).toBe('Label')
    expect(labels[0].text).toBe('Test')
  })

  it('imports layoutAlignSelf from stackChildAlignSelf', () => {
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
        name: 'Row',
        size: { x: 400, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        stackMode: 'HORIZONTAL'
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '!' },
        type: 'FRAME',
        name: 'Stretched',
        size: { x: 200, y: 50 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        stackChildAlignSelf: 'STRETCH'
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '"' },
        type: 'FRAME',
        name: 'Auto',
        size: { x: 200, y: 50 },
        transform: { m00: 1, m01: 0, m02: 200, m10: 0, m11: 1, m12: 0 }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    const row = getNodeOrThrow(graph, created[0])
    const children = graph.getChildren(row.id)
    expect(children[0].layoutAlignSelf).toBe('STRETCH')
    expect(children[1].layoutAlignSelf).toBe('AUTO')
  })

  it('imports clipsContent from frameMaskDisabled', () => {
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
        name: 'Clipped',
        size: { x: 200, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        frameMaskDisabled: false
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'FRAME',
        name: 'Unclipped',
        size: { x: 200, y: 100 },
        transform: { m00: 1, m01: 0, m02: 200, m10: 0, m11: 1, m12: 0 },
        frameMaskDisabled: true
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '#' },
        type: 'FRAME',
        name: 'Default',
        size: { x: 200, y: 100 },
        transform: { m00: 1, m01: 0, m02: 400, m10: 0, m11: 1, m12: 0 }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(getNodeOrThrow(graph, created[0]).clipsContent).toBe(true)
    expect(getNodeOrThrow(graph, created[1]).clipsContent).toBe(false)
    expect(getNodeOrThrow(graph, created[2]).clipsContent).toBe(false)
  })
})
