import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { canvas, doc, node } from './helpers'

describe('fig-import: stroke options', () => {
  test('stroke cap and join', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('VECTOR', 10, 1, {
        strokePaints: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL'
          }
        ],
        strokeWeight: 3,
        strokeAlign: 'CENTER',
        strokeCap: 'ROUND',
        strokeJoin: 'BEVEL'
      } as Partial<NodeChange>)
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.strokes[0].cap).toBe('ROUND')
    expect(n.strokes[0].join).toBe('BEVEL')
  })

  test('dash pattern', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('RECTANGLE', 10, 1, {
        strokePaints: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL'
          }
        ],
        strokeWeight: 2,
        strokeAlign: 'CENTER',
        dashPattern: [10, 5]
      } as Partial<NodeChange>)
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.strokes[0].dashPattern).toEqual([10, 5])
  })
})
