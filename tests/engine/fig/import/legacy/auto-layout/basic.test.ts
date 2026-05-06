import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { canvas, doc, node } from '../helpers'

describe('fig-import: auto-layout alignment', () => {
  test('maps SPACE_EVENLY kiwi primary alignment to Figma space-between', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('FRAME', 10, 1, {
        stackMode: 'HORIZONTAL',
        stackPrimaryAlignItems: 'SPACE_EVENLY'
      } as Partial<NodeChange>)
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.primaryAxisAlign).toBe('SPACE_BETWEEN')
  })
})
