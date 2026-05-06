import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { canvas, doc, node } from './helpers'

describe('fig-import: multiple fills', () => {
  test('solid + gradient stacked', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('RECTANGLE', 10, 1, {
        fillPaints: [
          {
            type: 'SOLID',
            color: { r: 1, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            blendMode: 'NORMAL'
          },
          {
            type: 'GRADIENT_LINEAR',
            opacity: 0.5,
            visible: true,
            blendMode: 'NORMAL',
            stops: [
              { color: { r: 1, g: 1, b: 1, a: 1 }, position: 0 },
              { color: { r: 0, g: 0, b: 0, a: 0 }, position: 1 }
            ],
            transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
          }
        ] as NodeChange['fillPaints']
      })
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.fills).toHaveLength(2)
    expect(n.fills[0].type).toBe('SOLID')
    expect(n.fills[1].type).toBe('GRADIENT_LINEAR')
    expect(n.fills[1].opacity).toBe(0.5)
  })
})
