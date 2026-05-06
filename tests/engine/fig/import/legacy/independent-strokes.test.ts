import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { canvas, doc, node } from './helpers'

describe('fig-import: independent stroke weights', () => {
  test('border weights imported', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('FRAME', 10, 1, {
        borderTopWeight: 2,
        borderRightWeight: 4,
        borderBottomWeight: 2,
        borderLeftWeight: 4,
        borderStrokeWeightsIndependent: true
      } as Partial<NodeChange>)
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.borderTopWeight).toBe(2)
    expect(n.borderRightWeight).toBe(4)
    expect(n.independentStrokeWeights).toBe(true)
  })
})
