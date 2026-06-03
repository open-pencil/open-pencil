import { describe, expect, test } from 'bun:test'

import type { NodeChange } from '#core/kiwi/fig/codec'
import { importNodeChanges } from '#core/kiwi/fig/import'
import { nodeChangeToProps } from '#core/kiwi/fig/node-change/convert'

describe('Figma boolean operation import', () => {
  test('preserves boolean operation nodes', () => {
    const props = nodeChangeToProps(
      {
        type: 'BOOLEAN_OPERATION',
        name: 'Imported boolean',
        booleanOperation: 'SUBTRACT'
      } as NodeChange,
      []
    )

    expect(props.nodeType).toBe('BOOLEAN_OPERATION')
    expect(props.booleanOperation).toBe('SUBTRACT')
  })

  test('imports boolean operation nodes with children', () => {
    const graph = importNodeChanges([
      {
        guid: { sessionID: 0, localID: 0 },
        type: 'DOCUMENT',
        name: 'Document',
        phase: 'CREATED'
      },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page',
        phase: 'CREATED'
      },
      {
        guid: { sessionID: 2, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'BOOLEAN_OPERATION',
        name: 'Imported boolean',
        booleanOperation: 'INTERSECT',
        phase: 'CREATED',
        size: { x: 120, y: 80 }
      },
      {
        guid: { sessionID: 2, localID: 2 },
        parentIndex: { guid: { sessionID: 2, localID: 1 }, position: '!' },
        type: 'RECTANGLE',
        name: 'Left operand',
        phase: 'CREATED',
        size: { x: 80, y: 80 }
      },
      {
        guid: { sessionID: 2, localID: 3 },
        parentIndex: { guid: { sessionID: 2, localID: 1 }, position: '"' },
        type: 'ELLIPSE',
        name: 'Right operand',
        phase: 'CREATED',
        size: { x: 80, y: 80 }
      }
    ] as NodeChange[])

    const booleanNode = graph.getChildren(graph.getPages()[0].id)[0]
    const children = graph.getChildren(booleanNode.id)

    expect(booleanNode.type).toBe('BOOLEAN_OPERATION')
    expect(booleanNode.booleanOperation).toBe('INTERSECT')
    expect(children.map((child) => child.type)).toEqual(['RECTANGLE', 'ELLIPSE'])
  })

  test('maps Kiwi XOR boolean operations to scene graph exclude', () => {
    const props = nodeChangeToProps(
      {
        type: 'BOOLEAN_OPERATION',
        name: 'Imported boolean',
        booleanOperation: 'XOR'
      } as NodeChange,
      []
    )

    expect(props.nodeType).toBe('BOOLEAN_OPERATION')
    expect(props.booleanOperation).toBe('EXCLUDE')
  })

  test('defaults missing boolean operations to union', () => {
    const props = nodeChangeToProps(
      {
        type: 'BOOLEAN_OPERATION',
        name: 'Imported boolean'
      } as NodeChange,
      []
    )

    expect(props.nodeType).toBe('BOOLEAN_OPERATION')
    expect(props.booleanOperation).toBe('UNION')
  })
})
