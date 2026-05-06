import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { canvas, doc, node } from './helpers'

describe('fig-import: blend mode', () => {
  test('node blend mode', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('RECTANGLE', 10, 1, {
        blendMode: 'MULTIPLY'
      } as Partial<NodeChange>)
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.blendMode).toBe('MULTIPLY')
  })

  test('defaults to PASS_THROUGH', () => {
    const graph = importNodeChanges([doc(), canvas(), node('RECTANGLE', 10, 1)])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.blendMode).toBe('PASS_THROUGH')
  })
})
