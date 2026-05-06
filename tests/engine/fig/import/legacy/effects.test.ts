import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'

import { canvas, doc, node } from './helpers'

describe('fig-import: effects', () => {
  test('drop shadow', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('RECTANGLE', 10, 1, {
        effects: [
          {
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.25 },
            offset: { x: 4, y: 4 },
            radius: 8,
            spread: 0,
            visible: true
          }
        ] as NodeChange['effects']
      })
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.effects).toHaveLength(1)
    expect(n.effects[0].type).toBe('DROP_SHADOW')
    expect(n.effects[0].radius).toBe(8)
    expect(n.effects[0].offset.x).toBe(4)
  })

  test('inner shadow', () => {
    const graph = importNodeChanges([
      doc(),
      canvas(),
      node('RECTANGLE', 10, 1, {
        effects: [
          {
            type: 'INNER_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.5 },
            offset: { x: 0, y: 2 },
            radius: 4,
            spread: 0,
            visible: true
          }
        ] as NodeChange['effects']
      })
    ])
    const n = graph.getChildren(graph.getPages()[0].id)[0]
    expect(n.effects[0].type).toBe('INNER_SHADOW')
  })
})
