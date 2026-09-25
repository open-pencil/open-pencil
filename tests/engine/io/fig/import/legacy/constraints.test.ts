import { describe, expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'

import { canvas, doc, node } from './helpers'

describe('fig-import: constraints', () => {
  test('horizontal and vertical constraints', () => {
    const graph = materializeDocument([
      doc(),
      canvas(),
      node('RECTANGLE', 10, 1, {
        horizontalConstraint: 'STRETCH',
        verticalConstraint: 'CENTER'
      } as Partial<NodeChange>)
    ]).graph
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.horizontalConstraint).toBe('STRETCH')
    expect(n.verticalConstraint).toBe('CENTER')
  })

  test('defaults to MIN', () => {
    const graph = materializeDocument([doc(), canvas(), node('RECTANGLE', 10, 1)]).graph
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.horizontalConstraint).toBe('MIN')
    expect(n.verticalConstraint).toBe('MIN')
  })
})
