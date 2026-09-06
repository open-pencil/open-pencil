import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { canvas, doc, node } from '../helpers'

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

  test('keeps omitted blend modes as PASS_THROUGH', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('TEXT', 10, 1),
      node('VECTOR', 11, 1),
      node('FRAME', 12, 1),
      node('RECTANGLE', 13, 1)
    ])
    expect(graph.getChildren(graph.getPages()[0].id).map((item) => item.blendMode)).toEqual([
      'PASS_THROUGH',
      'PASS_THROUGH',
      'PASS_THROUGH',
      'PASS_THROUGH'
    ])
  })
})
