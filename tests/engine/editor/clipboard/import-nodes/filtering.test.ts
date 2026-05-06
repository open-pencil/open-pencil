import { describe, expect, it } from 'bun:test'

import { importClipboardNodes } from '@open-pencil/core'
import type { NodeChange } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { createClipboardGraph } from '#tests/helpers/clipboard'

describe('importClipboardNodes: filtering', () => {
  it('skips VARIABLE_SET and VARIABLE nodes', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Document' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page 1'
      },
      {
        guid: { sessionID: 0, localID: 2 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'VARIABLE_SET',
        name: 'Primitives'
      },
      {
        guid: { sessionID: 0, localID: 3 },
        parentIndex: { guid: { sessionID: 0, localID: 2 }, position: '!' },
        type: 'VARIABLE',
        name: 'Colors/Brand/500'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'FRAME',
        name: 'Card',
        size: { x: 300, y: 200 },
        transform: { m00: 1, m01: 0, m02: 50, m10: 0, m11: 1, m12: 50 }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '!' },
        type: 'TEXT',
        name: 'Title',
        size: { x: 200, y: 30 },
        transform: { m00: 1, m01: 0, m02: 10, m10: 0, m11: 1, m12: 10 },
        textData: { characters: 'Hello' },
        fontSize: 16
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(created).toHaveLength(1)

    const card = getNodeOrThrow(graph, created[0])
    expect(card.type).toBe('FRAME')
    expect(card.name).toBe('Card')

    const children = graph.getChildren(card.id)
    expect(children).toHaveLength(1)
    expect(children[0].type).toBe('TEXT')
    expect(children[0].name).toBe('Title')

    const allNodes = [...graph.getAllNodes()]
    const variableNodes = allNodes.filter(
      (n) => n.name.includes('Primitives') || n.name.includes('Colors/')
    )
    expect(variableNodes).toHaveLength(0)
  })

  it('skips non-visual Figma types', () => {
    const { graph, pageId } = createClipboardGraph()

    const nonVisualTypes = [
      'WIDGET',
      'STAMP',
      'STICKY',
      'CONNECTOR',
      'CODE_BLOCK',
      'SHAPE_WITH_TEXT',
      'TABLE_NODE',
      'TABLE_CELL'
    ]
    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      ...nonVisualTypes.map((type, i) => ({
        guid: { sessionID: 0, localID: 100 + i },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: String.fromCharCode(33 + i) },
        type,
        name: `${type}_node`,
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      })),
      {
        guid: { sessionID: 0, localID: 200 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: 'z' },
        type: 'RECTANGLE',
        name: 'RealShape',
        size: { x: 50, y: 50 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(created).toHaveLength(1)
    expect(getNodeOrThrow(graph, created[0]).name).toBe('RealShape')
  })
})
